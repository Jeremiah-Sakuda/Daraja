/**
 * Task Engine types for structured form population via function calling
 * Based on PRD Section 6.4 - Structured Task Engine
 */

export type TaskEngineAction =
  | 'populate_field'
  | 'flag_for_human_review'
  | 'request_clarification'
  | 'finalize_form';

export interface PopulateFieldArgs {
  formId: string;
  fieldName: string;
  value: string | number | boolean | string[];
  sourceLang: string;
  confidence: number;
}

export interface FlagForReviewArgs {
  formId: string;
  fieldName: string;
  reason: ReviewReason;
  details?: string;
}

export type ReviewReason =
  | 'low_confidence'
  | 'ambiguous_response'
  | 'sensitive_content'
  | 'length_anomaly'
  | 'untranslated_segments'
  | 'domain_mismatch'
  | 'contradictory_information';

export interface RequestClarificationArgs {
  fieldName: string;
  lang: string;
  clarificationPrompt: string;
  options?: string[];
}

export interface FinalizeFormArgs {
  formId: string;
  notes?: string;
}

export interface TaskEngineCall {
  action: TaskEngineAction;
  args: PopulateFieldArgs | FlagForReviewArgs | RequestClarificationArgs | FinalizeFormArgs;
  timestamp: number;
}

export interface TaskEngineResponse {
  success: boolean;
  action: TaskEngineAction;
  message?: string;
  data?: unknown;
}

export interface FlaggedField {
  fieldId: string;
  fieldName: string;
  reason: ReviewReason;
  details?: string;
  flaggedAt: number;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface ClarificationRequest {
  id: string;
  fieldName: string;
  lang: string;
  prompt: string;
  options?: string[];
  requestedAt: number;
  responded: boolean;
  response?: string;
}

export interface TaskEngineState {
  formId: string;
  isActive: boolean;
  populatedFields: Set<string>;
  flaggedFields: Map<string, FlaggedField>;
  pendingClarifications: ClarificationRequest[];
  isFinalized: boolean;
  startedAt: number;
  finalizedAt?: number;
}

/**
 * Ollama function calling schema for task engine
 */
export const TASK_ENGINE_TOOLS = {
  populate_field: {
    type: 'function',
    function: {
      name: 'populate_field',
      description: 'Populate a form field with a value extracted from the conversation',
      parameters: {
        type: 'object',
        properties: {
          form_id: {
            type: 'string',
            description: 'The ID of the form being populated',
          },
          field_name: {
            type: 'string',
            description: 'The name of the field to populate',
          },
          value: {
            type: ['string', 'number', 'boolean', 'array'],
            description: 'The value to set for the field',
          },
          source_lang: {
            type: 'string',
            description: 'The language code of the source (e.g., "so" for Somali)',
          },
          confidence: {
            type: 'number',
            description: 'Confidence score from 0 to 1',
          },
        },
        required: ['form_id', 'field_name', 'value', 'source_lang', 'confidence'],
      },
    },
  },
  flag_for_human_review: {
    type: 'function',
    function: {
      name: 'flag_for_human_review',
      description: 'Flag a field for human review when confidence is low or content is ambiguous',
      parameters: {
        type: 'object',
        properties: {
          form_id: {
            type: 'string',
            description: 'The ID of the form',
          },
          field_name: {
            type: 'string',
            description: 'The name of the field to flag',
          },
          reason: {
            type: 'string',
            enum: [
              'low_confidence',
              'ambiguous_response',
              'sensitive_content',
              'length_anomaly',
              'untranslated_segments',
              'domain_mismatch',
              'contradictory_information',
            ],
            description: 'The reason for flagging',
          },
        },
        required: ['form_id', 'field_name', 'reason'],
      },
    },
  },
  request_clarification: {
    type: 'function',
    function: {
      name: 'request_clarification',
      description: 'Request clarification from the user when the response is unclear',
      parameters: {
        type: 'object',
        properties: {
          field_name: {
            type: 'string',
            description: 'The field requiring clarification',
          },
          lang: {
            type: 'string',
            description: 'The language to use for the clarification prompt',
          },
        },
        required: ['field_name', 'lang'],
      },
    },
  },
  finalize_form: {
    type: 'function',
    function: {
      name: 'finalize_form',
      description: 'Mark the form as complete when all required fields are populated',
      parameters: {
        type: 'object',
        properties: {
          form_id: {
            type: 'string',
            description: 'The ID of the form to finalize',
          },
        },
        required: ['form_id'],
      },
    },
  },
} as const;
