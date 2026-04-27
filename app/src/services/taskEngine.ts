/**
 * Task Engine Service - Structured form population via LLM function calling
 * Implements PRD Section 6.4 tools: populate_field, flag_for_human_review,
 * request_clarification, finalize_form
 */

import {
  TaskEngineState,
  TaskEngineCall,
  TaskEngineResponse,
  TaskEngineAction,
  PopulateFieldArgs,
  FlagForReviewArgs,
  RequestClarificationArgs,
  FinalizeFormArgs,
  FlaggedField,
  ClarificationRequest,
  ReviewReason,
  TASK_ENGINE_TOOLS,
} from '../types/taskEngine';
import { WorkflowSession, FieldResponse, TranslationRecord } from '../types/workflow';
import { ollamaClient } from './ollama';

// Confidence thresholds for automatic flagging
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8, // Show directly
  MEDIUM: 0.5, // Show with warning
  LOW: 0.5, // Flag for review (below this)
} as const;

export class TaskEngine {
  private state: TaskEngineState;
  private session: WorkflowSession | null = null;
  private listeners: Set<(state: TaskEngineState) => void> = new Set();
  private onFieldUpdate?: (fieldId: string, response: FieldResponse, translation: TranslationRecord) => void;
  private onClarificationRequest?: (request: ClarificationRequest) => void;
  private onFormFinalized?: (formId: string) => void;

  constructor(formId: string) {
    this.state = {
      formId,
      isActive: false,
      populatedFields: new Set(),
      flaggedFields: new Map(),
      pendingClarifications: [],
      isFinalized: false,
      startedAt: Date.now(),
    };
  }

  /**
   * Start the task engine with a workflow session
   */
  start(session: WorkflowSession): void {
    this.session = session;
    this.state.isActive = true;
    this.state.formId = session.id;
    this.notifyListeners();
  }

  /**
   * Get current state
   */
  getState(): TaskEngineState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: TaskEngineState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Set callback for field updates
   */
  onFieldUpdated(
    callback: (fieldId: string, response: FieldResponse, translation: TranslationRecord) => void
  ): void {
    this.onFieldUpdate = callback;
  }

  /**
   * Set callback for clarification requests
   */
  onClarificationRequested(callback: (request: ClarificationRequest) => void): void {
    this.onClarificationRequest = callback;
  }

  /**
   * Set callback for form finalization
   */
  onFormFinalizedCallback(callback: (formId: string) => void): void {
    this.onFormFinalized = callback;
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb(this.getState()));
  }

  /**
   * Process a user response and determine appropriate actions
   */
  async processResponse(
    fieldId: string,
    fieldName: string,
    sourceText: string,
    translatedText: string,
    sourceLang: string,
    confidence: number
  ): Promise<TaskEngineCall[]> {
    const calls: TaskEngineCall[] = [];

    // Always populate the field
    const populateArgs: PopulateFieldArgs = {
      formId: this.state.formId,
      fieldName,
      value: sourceText,
      sourceLang,
      confidence,
    };

    calls.push({
      action: 'populate_field',
      args: populateArgs,
      timestamp: Date.now(),
    });

    await this.executePopulateField(populateArgs, fieldId, translatedText);

    // Check if we need to flag for review based on confidence
    if (confidence < CONFIDENCE_THRESHOLDS.LOW) {
      const flagArgs: FlagForReviewArgs = {
        formId: this.state.formId,
        fieldName,
        reason: 'low_confidence',
        details: `Confidence score: ${(confidence * 100).toFixed(1)}%`,
      };

      calls.push({
        action: 'flag_for_human_review',
        args: flagArgs,
        timestamp: Date.now(),
      });

      await this.executeFlagForReview(flagArgs, fieldId);
    }

    // Check for other flagging conditions
    const additionalFlags = this.detectFlags(sourceText, translatedText, confidence);
    for (const flag of additionalFlags) {
      const flagArgs: FlagForReviewArgs = {
        formId: this.state.formId,
        fieldName,
        reason: flag.reason,
        details: flag.details,
      };

      calls.push({
        action: 'flag_for_human_review',
        args: flagArgs,
        timestamp: Date.now(),
      });

      await this.executeFlagForReview(flagArgs, fieldId);
    }

    return calls;
  }

  /**
   * Detect additional flags based on content analysis
   */
  private detectFlags(
    sourceText: string,
    translatedText: string,
    confidence: number
  ): Array<{ reason: ReviewReason; details: string }> {
    const flags: Array<{ reason: ReviewReason; details: string }> = [];

    // Length anomaly detection
    const lengthRatio = translatedText.length / (sourceText.length || 1);
    if (lengthRatio < 0.3 || lengthRatio > 3) {
      flags.push({
        reason: 'length_anomaly',
        details: `Translation length ratio: ${lengthRatio.toFixed(2)}`,
      });
    }

    // Untranslated segments (source text appearing in translation)
    const sourceWords = sourceText.toLowerCase().split(/\s+/);
    const translatedLower = translatedText.toLowerCase();
    const untranslatedWords = sourceWords.filter(
      (word) => word.length > 4 && translatedLower.includes(word)
    );
    if (untranslatedWords.length > sourceWords.length * 0.3) {
      flags.push({
        reason: 'untranslated_segments',
        details: `Potential untranslated words: ${untranslatedWords.slice(0, 5).join(', ')}`,
      });
    }

    return flags;
  }

  /**
   * Execute populate_field action
   */
  private async executePopulateField(
    args: PopulateFieldArgs,
    fieldId: string,
    translatedText: string
  ): Promise<TaskEngineResponse> {
    const response: FieldResponse = {
      fieldId,
      value: args.value,
      originalLanguage: args.sourceLang,
      capturedAt: Date.now(),
      inputMethod: 'voice', // Could be parameterized
    };

    const translation: TranslationRecord = {
      fieldId,
      sourceText: String(args.value),
      translatedText,
      confidence: args.confidence,
      flaggedForReview: args.confidence < CONFIDENCE_THRESHOLDS.LOW,
    };

    this.state.populatedFields.add(fieldId);
    this.notifyListeners();

    this.onFieldUpdate?.(fieldId, response, translation);

    return {
      success: true,
      action: 'populate_field',
      message: `Field ${args.fieldName} populated with confidence ${(args.confidence * 100).toFixed(1)}%`,
    };
  }

  /**
   * Execute flag_for_human_review action
   */
  private async executeFlagForReview(
    args: FlagForReviewArgs,
    fieldId: string
  ): Promise<TaskEngineResponse> {
    const flag: FlaggedField = {
      fieldId,
      fieldName: args.fieldName,
      reason: args.reason,
      details: args.details,
      flaggedAt: Date.now(),
      resolved: false,
    };

    this.state.flaggedFields.set(fieldId, flag);
    this.notifyListeners();

    return {
      success: true,
      action: 'flag_for_human_review',
      message: `Field ${args.fieldName} flagged for review: ${args.reason}`,
      data: flag,
    };
  }

  /**
   * Execute request_clarification action
   */
  async requestClarification(args: RequestClarificationArgs): Promise<TaskEngineResponse> {
    const request: ClarificationRequest = {
      id: `clarify-${Date.now()}`,
      fieldName: args.fieldName,
      lang: args.lang,
      prompt: args.clarificationPrompt,
      options: args.options,
      requestedAt: Date.now(),
      responded: false,
    };

    this.state.pendingClarifications.push(request);
    this.notifyListeners();

    this.onClarificationRequest?.(request);

    return {
      success: true,
      action: 'request_clarification',
      message: `Clarification requested for ${args.fieldName}`,
      data: request,
    };
  }

  /**
   * Respond to a clarification request
   */
  respondToClarification(requestId: string, response: string): void {
    const request = this.state.pendingClarifications.find((r) => r.id === requestId);
    if (request) {
      request.responded = true;
      request.response = response;
      this.notifyListeners();
    }
  }

  /**
   * Resolve a flagged field
   */
  resolveFlag(fieldId: string, resolvedBy?: string): void {
    const flag = this.state.flaggedFields.get(fieldId);
    if (flag) {
      flag.resolved = true;
      flag.resolvedAt = Date.now();
      flag.resolvedBy = resolvedBy;
      this.notifyListeners();
    }
  }

  /**
   * Execute finalize_form action
   */
  async finalizeForm(args: FinalizeFormArgs): Promise<TaskEngineResponse> {
    // Check if all required fields are populated
    const unresolvedFlags = Array.from(this.state.flaggedFields.values()).filter(
      (f) => !f.resolved
    );

    if (unresolvedFlags.length > 0) {
      return {
        success: false,
        action: 'finalize_form',
        message: `Cannot finalize: ${unresolvedFlags.length} unresolved flags`,
        data: unresolvedFlags,
      };
    }

    this.state.isFinalized = true;
    this.state.finalizedAt = Date.now();
    this.state.isActive = false;
    this.notifyListeners();

    this.onFormFinalized?.(args.formId);

    return {
      success: true,
      action: 'finalize_form',
      message: 'Form finalized successfully',
    };
  }

  /**
   * Check if form can be finalized
   */
  canFinalize(): { canFinalize: boolean; blockers: string[] } {
    const blockers: string[] = [];

    const unresolvedFlags = Array.from(this.state.flaggedFields.values()).filter(
      (f) => !f.resolved
    );
    if (unresolvedFlags.length > 0) {
      blockers.push(`${unresolvedFlags.length} fields flagged for review`);
    }

    const pendingClarifications = this.state.pendingClarifications.filter((c) => !c.responded);
    if (pendingClarifications.length > 0) {
      blockers.push(`${pendingClarifications.length} pending clarifications`);
    }

    return {
      canFinalize: blockers.length === 0,
      blockers,
    };
  }

  /**
   * Get summary of task engine activity
   */
  getSummary(): {
    fieldsPopulated: number;
    fieldsFlagged: number;
    flagsResolved: number;
    clarificationsRequested: number;
    clarificationsResponded: number;
    isFinalized: boolean;
    duration: number;
  } {
    const flagsResolved = Array.from(this.state.flaggedFields.values()).filter(
      (f) => f.resolved
    ).length;
    const clarificationsResponded = this.state.pendingClarifications.filter(
      (c) => c.responded
    ).length;

    return {
      fieldsPopulated: this.state.populatedFields.size,
      fieldsFlagged: this.state.flaggedFields.size,
      flagsResolved,
      clarificationsRequested: this.state.pendingClarifications.length,
      clarificationsResponded,
      isFinalized: this.state.isFinalized,
      duration: (this.state.finalizedAt || Date.now()) - this.state.startedAt,
    };
  }

  /**
   * Get Ollama tools configuration for function calling
   */
  static getToolsConfig(): typeof TASK_ENGINE_TOOLS {
    return TASK_ENGINE_TOOLS;
  }

  /**
   * Reset the task engine state
   */
  reset(): void {
    this.state = {
      formId: this.state.formId,
      isActive: false,
      populatedFields: new Set(),
      flaggedFields: new Map(),
      pendingClarifications: [],
      isFinalized: false,
      startedAt: Date.now(),
    };
    this.session = null;
    this.notifyListeners();
  }
}

/**
 * Create a new task engine instance for a form
 */
export function createTaskEngine(formId: string): TaskEngine {
  return new TaskEngine(formId);
}

/**
 * Singleton task engine for current session
 */
let currentEngine: TaskEngine | null = null;

export function getOrCreateTaskEngine(formId: string): TaskEngine {
  if (!currentEngine || currentEngine.getState().formId !== formId) {
    currentEngine = new TaskEngine(formId);
  }
  return currentEngine;
}

export function getCurrentTaskEngine(): TaskEngine | null {
  return currentEngine;
}

export function clearCurrentTaskEngine(): void {
  currentEngine = null;
}
