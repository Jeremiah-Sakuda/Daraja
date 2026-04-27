import { useState, useCallback, useEffect, useRef } from 'react';
import {
  TaskEngine,
  getOrCreateTaskEngine,
  clearCurrentTaskEngine,
} from '../services/taskEngine';
import {
  TaskEngineState,
  FlaggedField,
  ClarificationRequest,
} from '../types/taskEngine';
import { WorkflowSession, FieldResponse, TranslationRecord } from '../types/workflow';

export interface UseTaskEngineOptions {
  onFieldUpdate?: (fieldId: string, response: FieldResponse, translation: TranslationRecord) => void;
  onClarificationRequest?: (request: ClarificationRequest) => void;
  onFormFinalized?: (formId: string) => void;
}

export interface UseTaskEngineReturn {
  // State
  state: TaskEngineState | null;
  isActive: boolean;
  flaggedFields: FlaggedField[];
  pendingClarifications: ClarificationRequest[];

  // Actions
  start: (session: WorkflowSession) => void;
  processResponse: (
    fieldId: string,
    fieldName: string,
    sourceText: string,
    translatedText: string,
    sourceLang: string,
    confidence: number
  ) => Promise<void>;
  requestClarification: (
    fieldName: string,
    lang: string,
    prompt: string,
    options?: string[]
  ) => Promise<void>;
  respondToClarification: (requestId: string, response: string) => void;
  resolveFlag: (fieldId: string, resolvedBy?: string) => void;
  finalize: () => Promise<{ success: boolean; message: string }>;
  reset: () => void;

  // Helpers
  canFinalize: () => { canFinalize: boolean; blockers: string[] };
  getSummary: () => ReturnType<TaskEngine['getSummary']>;
}

/**
 * Hook for using the Task Engine in interview components
 */
export function useTaskEngine(
  formId: string,
  options: UseTaskEngineOptions = {}
): UseTaskEngineReturn {
  const { onFieldUpdate, onClarificationRequest, onFormFinalized } = options;

  const engineRef = useRef<TaskEngine | null>(null);
  const [state, setState] = useState<TaskEngineState | null>(null);

  // Initialize or get existing engine
  useEffect(() => {
    engineRef.current = getOrCreateTaskEngine(formId);

    // Set up callbacks
    if (onFieldUpdate) {
      engineRef.current.onFieldUpdated(onFieldUpdate);
    }
    if (onClarificationRequest) {
      engineRef.current.onClarificationRequested(onClarificationRequest);
    }
    if (onFormFinalized) {
      engineRef.current.onFormFinalizedCallback(onFormFinalized);
    }

    // Subscribe to state changes
    const unsubscribe = engineRef.current.subscribe(setState);
    setState(engineRef.current.getState());

    return () => {
      unsubscribe();
    };
  }, [formId, onFieldUpdate, onClarificationRequest, onFormFinalized]);

  const start = useCallback((session: WorkflowSession) => {
    engineRef.current?.start(session);
  }, []);

  const processResponse = useCallback(
    async (
      fieldId: string,
      fieldName: string,
      sourceText: string,
      translatedText: string,
      sourceLang: string,
      confidence: number
    ) => {
      await engineRef.current?.processResponse(
        fieldId,
        fieldName,
        sourceText,
        translatedText,
        sourceLang,
        confidence
      );
    },
    []
  );

  const requestClarification = useCallback(
    async (fieldName: string, lang: string, prompt: string, options?: string[]) => {
      await engineRef.current?.requestClarification({
        fieldName,
        lang,
        clarificationPrompt: prompt,
        options,
      });
    },
    []
  );

  const respondToClarification = useCallback((requestId: string, response: string) => {
    engineRef.current?.respondToClarification(requestId, response);
  }, []);

  const resolveFlag = useCallback((fieldId: string, resolvedBy?: string) => {
    engineRef.current?.resolveFlag(fieldId, resolvedBy);
  }, []);

  const finalize = useCallback(async () => {
    if (!engineRef.current) {
      return { success: false, message: 'No active task engine' };
    }

    const result = await engineRef.current.finalizeForm({
      formId: engineRef.current.getState().formId,
    });

    return {
      success: result.success,
      message: result.message || '',
    };
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
    clearCurrentTaskEngine();
  }, []);

  const canFinalize = useCallback(() => {
    return engineRef.current?.canFinalize() || { canFinalize: false, blockers: ['No active engine'] };
  }, []);

  const getSummary = useCallback(() => {
    return (
      engineRef.current?.getSummary() || {
        fieldsPopulated: 0,
        fieldsFlagged: 0,
        flagsResolved: 0,
        clarificationsRequested: 0,
        clarificationsResponded: 0,
        isFinalized: false,
        duration: 0,
      }
    );
  }, []);

  // Derive flagged fields and pending clarifications from state
  const flaggedFields = state
    ? Array.from(state.flaggedFields.values())
    : [];

  const pendingClarifications = state?.pendingClarifications.filter(
    (c) => !c.responded
  ) || [];

  return {
    state,
    isActive: state?.isActive || false,
    flaggedFields,
    pendingClarifications,
    start,
    processResponse,
    requestClarification,
    respondToClarification,
    resolveFlag,
    finalize,
    reset,
    canFinalize,
    getSummary,
  };
}
