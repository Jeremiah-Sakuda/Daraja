/**
 * Workflow Service
 *
 * Manages structured interview workflows and form state.
 * Supports RSD interviews, medical intake, and legal declarations.
 */

import type { TranslationResponse } from './translation';
import type { ConfidenceScore } from './confidence';

// Workflow Schema Types
export interface WorkflowSchema {
  id: string;
  version: string;
  name: string;
  description: string;
  organization: string;
  languagePairs: string[];
  sections: WorkflowSection[];
  metadata: {
    estimatedDuration: string;
    requiresSignature: boolean;
    privacyLevel: 'standard' | 'sensitive' | 'highly_sensitive';
  };
}

export interface WorkflowSection {
  id: string;
  title: string;
  description?: string;
  fields: WorkflowField[];
  conditionalOn?: {
    fieldId: string;
    value: string | boolean;
  };
}

export interface WorkflowField {
  id: string;
  type: 'text' | 'voice' | 'document' | 'select' | 'date' | 'number' | 'boolean' | 'multiline';
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  validation?: FieldValidation;
  translatable: boolean;
  domain?: string;
  options?: SelectOption[];
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface SelectOption {
  value: string;
  label: string;
  labelTranslated?: string;
}

// Session State Types
export interface WorkflowSession {
  id: string;
  workflowId: string;
  workflowVersion: string;
  languagePair: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  currentSectionIndex: number;
  currentFieldIndex: number;
  responses: FieldResponse[];
  flags: SessionFlag[];
  metadata: Record<string, unknown>;
}

export interface FieldResponse {
  fieldId: string;
  sectionId: string;
  sourceText: string;
  translatedText?: string;
  confidence?: ConfidenceScore;
  inputMethod: 'voice' | 'text' | 'document' | 'select';
  timestamp: string;
  audioBlob?: Blob;
  imageData?: string;
}

export interface SessionFlag {
  fieldId: string;
  type: 'low_confidence' | 'requires_review' | 'incomplete' | 'validation_error';
  message: string;
  timestamp: string;
  resolved: boolean;
}

// Workflow Management Class
export class WorkflowManager {
  private schemas: Map<string, WorkflowSchema> = new Map();
  private currentSession: WorkflowSession | null = null;

  /**
   * Load workflow schemas
   */
  async loadSchemas(): Promise<void> {
    // In production, these would be fetched from files or API
    const schemaModules = [
      () => import('../../workflows/schemas/rsd_interview.json'),
      // () => import('../../workflows/schemas/medical_intake.json'),
      // () => import('../../workflows/schemas/legal_declaration.json'),
    ];

    for (const loadSchema of schemaModules) {
      try {
        const module = await loadSchema();
        const schema = module.default as WorkflowSchema;
        this.schemas.set(schema.id, schema);
      } catch (error) {
        console.warn('Failed to load workflow schema:', error);
      }
    }
  }

  /**
   * Get available workflows
   */
  getAvailableWorkflows(): WorkflowSchema[] {
    return Array.from(this.schemas.values());
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(id: string): WorkflowSchema | undefined {
    return this.schemas.get(id);
  }

  /**
   * Start a new session
   */
  startSession(workflowId: string, languagePair: string): WorkflowSession {
    const workflow = this.schemas.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const session: WorkflowSession = {
      id: generateSessionId(),
      workflowId,
      workflowVersion: workflow.version,
      languagePair,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'in_progress',
      currentSectionIndex: 0,
      currentFieldIndex: 0,
      responses: [],
      flags: [],
      metadata: {},
    };

    this.currentSession = session;
    return session;
  }

  /**
   * Get current session
   */
  getCurrentSession(): WorkflowSession | null {
    return this.currentSession;
  }

  /**
   * Resume an existing session
   */
  resumeSession(session: WorkflowSession): void {
    this.currentSession = session;
  }

  /**
   * Get current field
   */
  getCurrentField(): { section: WorkflowSection; field: WorkflowField } | null {
    if (!this.currentSession) return null;

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) return null;

    const section = workflow.sections[this.currentSession.currentSectionIndex];
    if (!section) return null;

    const field = section.fields[this.currentSession.currentFieldIndex];
    if (!field) return null;

    return { section, field };
  }

  /**
   * Record a response
   */
  recordResponse(
    fieldId: string,
    sourceText: string,
    translation?: TranslationResponse
  ): FieldResponse {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Find the field's section
    let sectionId = '';
    for (const section of workflow.sections) {
      if (section.fields.some((f) => f.id === fieldId)) {
        sectionId = section.id;
        break;
      }
    }

    const response: FieldResponse = {
      fieldId,
      sectionId,
      sourceText,
      translatedText: translation?.translatedText,
      confidence: translation?.confidence,
      inputMethod: 'text', // Default, can be overridden
      timestamp: new Date().toISOString(),
    };

    // Update or add response
    const existingIndex = this.currentSession.responses.findIndex(
      (r) => r.fieldId === fieldId
    );

    if (existingIndex >= 0) {
      this.currentSession.responses[existingIndex] = response;
    } else {
      this.currentSession.responses.push(response);
    }

    // Check for low confidence flags
    if (translation?.confidence?.level === 'low') {
      this.addFlag(fieldId, 'low_confidence', 'Translation confidence is low');
    }

    this.currentSession.updatedAt = new Date().toISOString();
    return response;
  }

  /**
   * Add a flag to the session
   */
  addFlag(fieldId: string, type: SessionFlag['type'], message: string): void {
    if (!this.currentSession) return;

    // Don't add duplicate flags
    const exists = this.currentSession.flags.some(
      (f) => f.fieldId === fieldId && f.type === type && !f.resolved
    );

    if (!exists) {
      this.currentSession.flags.push({
        fieldId,
        type,
        message,
        timestamp: new Date().toISOString(),
        resolved: false,
      });
    }
  }

  /**
   * Resolve a flag
   */
  resolveFlag(fieldId: string, type: SessionFlag['type']): void {
    if (!this.currentSession) return;

    const flag = this.currentSession.flags.find(
      (f) => f.fieldId === fieldId && f.type === type && !f.resolved
    );

    if (flag) {
      flag.resolved = true;
    }
  }

  /**
   * Navigate to next field
   */
  nextField(): boolean {
    if (!this.currentSession) return false;

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) return false;

    const currentSection = workflow.sections[this.currentSession.currentSectionIndex];
    if (!currentSection) return false;

    // Try next field in current section
    if (this.currentSession.currentFieldIndex < currentSection.fields.length - 1) {
      this.currentSession.currentFieldIndex++;
      return true;
    }

    // Try next section
    if (this.currentSession.currentSectionIndex < workflow.sections.length - 1) {
      this.currentSession.currentSectionIndex++;
      this.currentSession.currentFieldIndex = 0;
      return true;
    }

    // End of workflow
    return false;
  }

  /**
   * Navigate to previous field
   */
  previousField(): boolean {
    if (!this.currentSession) return false;

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) return false;

    // Try previous field in current section
    if (this.currentSession.currentFieldIndex > 0) {
      this.currentSession.currentFieldIndex--;
      return true;
    }

    // Try previous section
    if (this.currentSession.currentSectionIndex > 0) {
      this.currentSession.currentSectionIndex--;
      const prevSection = workflow.sections[this.currentSession.currentSectionIndex];
      this.currentSession.currentFieldIndex = prevSection.fields.length - 1;
      return true;
    }

    // At start of workflow
    return false;
  }

  /**
   * Go to specific field
   */
  goToField(sectionIndex: number, fieldIndex: number): boolean {
    if (!this.currentSession) return false;

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) return false;

    if (sectionIndex < 0 || sectionIndex >= workflow.sections.length) return false;

    const section = workflow.sections[sectionIndex];
    if (fieldIndex < 0 || fieldIndex >= section.fields.length) return false;

    this.currentSession.currentSectionIndex = sectionIndex;
    this.currentSession.currentFieldIndex = fieldIndex;
    return true;
  }

  /**
   * Calculate progress
   */
  getProgress(): { completed: number; total: number; percentage: number } {
    if (!this.currentSession) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    let total = 0;
    let completed = 0;

    for (const section of workflow.sections) {
      for (const field of section.fields) {
        total++;
        const hasResponse = this.currentSession.responses.some(
          (r) => r.fieldId === field.id && r.sourceText.trim()
        );
        if (hasResponse) {
          completed++;
        }
      }
    }

    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  /**
   * Validate session for completion
   */
  validateForCompletion(): { valid: boolean; errors: string[] } {
    if (!this.currentSession) {
      return { valid: false, errors: ['No active session'] };
    }

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) {
      return { valid: false, errors: ['Workflow not found'] };
    }

    const errors: string[] = [];

    for (const section of workflow.sections) {
      for (const field of section.fields) {
        if (field.required) {
          const response = this.currentSession.responses.find(
            (r) => r.fieldId === field.id
          );

          if (!response || !response.sourceText.trim()) {
            errors.push(`Required field missing: ${field.label}`);
          }
        }
      }
    }

    // Check for unresolved critical flags
    const unresolvedCritical = this.currentSession.flags.filter(
      (f) => !f.resolved && f.type === 'low_confidence'
    );

    if (unresolvedCritical.length > 0) {
      errors.push(
        `${unresolvedCritical.length} translation(s) need review before completion`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Complete the session
   */
  completeSession(): WorkflowSession {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const validation = this.validateForCompletion();
    if (!validation.valid) {
      throw new Error(`Cannot complete session: ${validation.errors.join(', ')}`);
    }

    this.currentSession.status = 'completed';
    this.currentSession.completedAt = new Date().toISOString();
    this.currentSession.updatedAt = new Date().toISOString();

    return this.currentSession;
  }

  /**
   * Abandon the session
   */
  abandonSession(): void {
    if (this.currentSession) {
      this.currentSession.status = 'abandoned';
      this.currentSession.updatedAt = new Date().toISOString();
      this.currentSession = null;
    }
  }

  /**
   * Export session data for PDF generation
   */
  exportSessionData(): {
    workflow: WorkflowSchema;
    session: WorkflowSession;
    formattedResponses: Array<{
      section: string;
      field: string;
      source: string;
      translation: string;
      confidence: string;
      flagged: boolean;
    }>;
  } | null {
    if (!this.currentSession) return null;

    const workflow = this.schemas.get(this.currentSession.workflowId);
    if (!workflow) return null;

    const formattedResponses = [];

    for (const section of workflow.sections) {
      for (const field of section.fields) {
        const response = this.currentSession.responses.find(
          (r) => r.fieldId === field.id
        );

        formattedResponses.push({
          section: section.title,
          field: field.label,
          source: response?.sourceText || '',
          translation: response?.translatedText || '',
          confidence: response?.confidence
            ? `${Math.round(response.confidence.overall * 100)}%`
            : 'N/A',
          flagged: response?.confidence?.level === 'low',
        });
      }
    }

    return {
      workflow,
      session: this.currentSession,
      formattedResponses,
    };
  }
}

// Utility functions
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Singleton instance
export const workflowManager = new WorkflowManager();
