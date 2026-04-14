/**
 * Workflow types for structured interview forms
 */

export type WorkflowType = 'rsd_interview' | 'medical_intake' | 'legal_declaration';

export interface Workflow {
  id: string;
  type: WorkflowType;
  title: string;
  description: string;
  sections: WorkflowSection[];
}

export interface WorkflowSection {
  id: string;
  title: string;
  description?: string;
  fields: WorkflowField[];
  order: number;
}

export interface WorkflowField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  uiConfig?: FieldUIConfig;
}

export type FieldType =
  | 'text'
  | 'longText'
  | 'date'
  | 'select'
  | 'multiSelect'
  | 'number'
  | 'boolean'
  | 'location'
  | 'voice';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface FieldUIConfig {
  voiceEnabled: boolean;
  promptHint?: string;
  translationPriority?: 'critical' | 'high' | 'standard' | 'low';
}

// Session state
export interface WorkflowSession {
  id: string;
  workflowId: string;
  workflowType: WorkflowType;
  startedAt: number;
  lastUpdatedAt: number;
  completedAt?: number;
  currentSectionIndex: number;
  currentFieldIndex: number;
  responses: Record<string, FieldResponse>;
  translations: Record<string, TranslationRecord>;
  status: 'in_progress' | 'completed' | 'exported';
}

export interface FieldResponse {
  fieldId: string;
  value: string | string[] | number | boolean;
  originalLanguage: string;
  capturedAt: number;
  inputMethod: 'voice' | 'text' | 'selection';
}

export interface TranslationRecord {
  fieldId: string;
  sourceText: string;
  translatedText: string;
  confidence: number;
  flaggedForReview: boolean;
  reviewedAt?: number;
  reviewerNotes?: string;
}

// Predefined workflows
export const WORKFLOWS: Record<WorkflowType, Workflow> = {
  rsd_interview: {
    id: 'rsd-001',
    type: 'rsd_interview',
    title: 'RSD Interview',
    description: 'Refugee Status Determination Interview Form',
    sections: [
      {
        id: 'personal',
        title: 'Personal Information',
        description: 'Basic biographical information',
        order: 0,
        fields: [
          {
            id: 'fullName',
            name: 'fullName',
            label: 'Full Name',
            type: 'text',
            required: true,
            placeholder: 'Enter full legal name',
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What is your full name as it appears on your documents?',
              translationPriority: 'high',
            },
          },
          {
            id: 'dateOfBirth',
            name: 'dateOfBirth',
            label: 'Date of Birth',
            type: 'date',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'When were you born?',
            },
          },
          {
            id: 'nationality',
            name: 'nationality',
            label: 'Nationality',
            type: 'text',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What is your nationality?',
            },
          },
          {
            id: 'ethnicity',
            name: 'ethnicity',
            label: 'Ethnicity/Clan',
            type: 'text',
            required: false,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What is your ethnic group or clan?',
            },
          },
        ],
      },
      {
        id: 'flight',
        title: 'Reasons for Flight',
        description: 'Why you left your country',
        order: 1,
        fields: [
          {
            id: 'mainReason',
            name: 'mainReason',
            label: 'Main Reason for Leaving',
            type: 'longText',
            required: true,
            helpText: 'Please describe the main reason you left your country.',
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'Please tell me the main reason why you left your country.',
              translationPriority: 'critical',
            },
          },
          {
            id: 'departureDate',
            name: 'departureDate',
            label: 'Date of Departure',
            type: 'date',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'When did you leave your country?',
            },
          },
        ],
      },
      {
        id: 'persecution',
        title: 'Persecution Claims',
        description: 'Details of persecution or feared persecution',
        order: 2,
        fields: [
          {
            id: 'persecutionType',
            name: 'persecutionType',
            label: 'Type of Persecution',
            type: 'multiSelect',
            required: true,
            options: [
              { value: 'race', label: 'Race' },
              { value: 'religion', label: 'Religion' },
              { value: 'nationality', label: 'Nationality' },
              { value: 'political', label: 'Political Opinion' },
              { value: 'social', label: 'Social Group' },
              { value: 'gender', label: 'Gender' },
            ],
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What type of persecution have you experienced or fear?',
            },
          },
          {
            id: 'persecutors',
            name: 'persecutors',
            label: 'Who Persecuted You',
            type: 'longText',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'Who persecuted you or who do you fear?',
              translationPriority: 'critical',
            },
          },
          {
            id: 'fearOfReturn',
            name: 'fearOfReturn',
            label: 'Fear if Returned',
            type: 'longText',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What do you fear will happen if you return to your country?',
              translationPriority: 'critical',
            },
          },
        ],
      },
    ],
  },
  medical_intake: {
    id: 'med-001',
    type: 'medical_intake',
    title: 'Medical Intake',
    description: 'Primary Care Intake Form',
    sections: [
      {
        id: 'patient',
        title: 'Patient Information',
        order: 0,
        fields: [
          {
            id: 'patientName',
            name: 'patientName',
            label: 'Patient Name',
            type: 'text',
            required: true,
            uiConfig: { voiceEnabled: true, promptHint: 'What is your name?' },
          },
          {
            id: 'dateOfBirth',
            name: 'dateOfBirth',
            label: 'Date of Birth',
            type: 'date',
            required: true,
            uiConfig: { voiceEnabled: true, promptHint: 'When were you born?' },
          },
        ],
      },
      {
        id: 'complaint',
        title: 'Chief Complaint',
        order: 1,
        fields: [
          {
            id: 'mainComplaint',
            name: 'mainComplaint',
            label: 'Main Health Concern',
            type: 'longText',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'What is your main health concern today?',
              translationPriority: 'critical',
            },
          },
          {
            id: 'duration',
            name: 'duration',
            label: 'Duration',
            type: 'text',
            required: false,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'How long have you had this problem?',
            },
          },
        ],
      },
    ],
  },
  legal_declaration: {
    id: 'legal-001',
    type: 'legal_declaration',
    title: 'Legal Declaration',
    description: 'Sworn Statement Form',
    sections: [
      {
        id: 'declarant',
        title: 'Declarant Information',
        order: 0,
        fields: [
          {
            id: 'fullName',
            name: 'fullName',
            label: 'Full Legal Name',
            type: 'text',
            required: true,
            uiConfig: { voiceEnabled: true, promptHint: 'State your full legal name.' },
          },
        ],
      },
      {
        id: 'statement',
        title: 'Statement',
        order: 1,
        fields: [
          {
            id: 'mainStatement',
            name: 'mainStatement',
            label: 'Declaration',
            type: 'longText',
            required: true,
            uiConfig: {
              voiceEnabled: true,
              promptHint: 'Please make your statement.',
              translationPriority: 'critical',
            },
          },
        ],
      },
    ],
  },
};
