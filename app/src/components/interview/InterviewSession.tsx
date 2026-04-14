import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FormCard } from './FormCard';
import { ProgressIndicator } from './ProgressIndicator';
import { VoiceInput } from '../input/VoiceInput';
import { TranslationDisplay } from '../translation/TranslationDisplay';
import { useOllama } from '../../hooks/useOllama';
import { WORKFLOWS, type WorkflowType, type WorkflowSession, type FieldResponse, type TranslationRecord } from '../../types/workflow';
import type { TranslationResponse } from '../../types/translation';
import { ArrowLeft, ArrowRight, CheckCircle, FileText } from 'lucide-react';

export function InterviewSession() {
  const { workflowType: workflowParam } = useParams<{ workflowType: string }>();
  const navigate = useNavigate();

  // Validate and default workflow type
  const workflowType: WorkflowType =
    workflowParam && workflowParam in WORKFLOWS
      ? (workflowParam as WorkflowType)
      : 'rsd_interview';

  const workflow = WORKFLOWS[workflowType];

  const [session, setSession] = useState<WorkflowSession>(() => ({
    id: `session-${Date.now()}`,
    workflowId: workflow.id,
    workflowType,
    startedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    currentSectionIndex: 0,
    currentFieldIndex: 0,
    responses: {},
    translations: {},
    status: 'in_progress',
  }));

  const [currentTranslation, setCurrentTranslation] = useState<TranslationResponse | null>(null);
  const [inputValue, setInputValue] = useState('');

  const { translate, isLoading: isTranslating, selectedPair } = useOllama();

  const currentSection = workflow.sections[session.currentSectionIndex];
  const currentField = currentSection?.fields[session.currentFieldIndex];
  const totalFields = workflow.sections.reduce((sum, s) => sum + s.fields.length, 0);
  const completedFields = Object.keys(session.responses).length;

  // Handle voice input completion
  const handleVoiceComplete = useCallback(
    async (text: string) => {
      setInputValue(text);

      // Translate the input
      const response = await translate({
        text,
        sourceLang: selectedPair.source.code,
        targetLang: selectedPair.target.code,
        domain: 'humanitarian',
      });

      if (response) {
        setCurrentTranslation(response);
      }
    },
    [translate, selectedPair]
  );

  // Handle text input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
    setCurrentTranslation(null);
  };

  // Handle manual translation
  const handleTranslate = useCallback(async () => {
    if (!inputValue.trim()) return;

    const response = await translate({
      text: inputValue,
      sourceLang: selectedPair.source.code,
      targetLang: selectedPair.target.code,
      domain: 'humanitarian',
    });

    if (response) {
      setCurrentTranslation(response);
    }
  }, [inputValue, translate, selectedPair]);

  // Save current response and move to next field
  const handleSaveAndNext = useCallback(() => {
    if (!currentField || !inputValue.trim()) return;

    // Save response
    const fieldResponse: FieldResponse = {
      fieldId: currentField.id,
      value: inputValue,
      originalLanguage: selectedPair.source.code,
      capturedAt: Date.now(),
      inputMethod: 'voice',
    };

    // Save translation if available
    const translationRecord: TranslationRecord | undefined = currentTranslation
      ? {
          fieldId: currentField.id,
          sourceText: currentTranslation.sourceText,
          translatedText: currentTranslation.translatedText,
          confidence: currentTranslation.confidence,
          flaggedForReview: currentTranslation.confidenceLevel === 'low',
        }
      : undefined;

    setSession((s) => {
      const newResponses = { ...s.responses, [currentField.id]: fieldResponse };
      const newTranslations = translationRecord
        ? { ...s.translations, [currentField.id]: translationRecord }
        : s.translations;

      // Calculate next position
      let nextSectionIndex = s.currentSectionIndex;
      let nextFieldIndex = s.currentFieldIndex + 1;

      if (nextFieldIndex >= currentSection.fields.length) {
        nextSectionIndex++;
        nextFieldIndex = 0;
      }

      const isComplete = nextSectionIndex >= workflow.sections.length;

      return {
        ...s,
        responses: newResponses,
        translations: newTranslations,
        currentSectionIndex: isComplete ? s.currentSectionIndex : nextSectionIndex,
        currentFieldIndex: isComplete ? s.currentFieldIndex : nextFieldIndex,
        lastUpdatedAt: Date.now(),
        status: isComplete ? 'completed' : 'in_progress',
        completedAt: isComplete ? Date.now() : undefined,
      };
    });

    // Clear for next field
    setInputValue('');
    setCurrentTranslation(null);
  }, [currentField, inputValue, currentTranslation, currentSection, workflow, selectedPair]);

  // Go to previous field
  const handlePrevious = useCallback(() => {
    setSession((s) => {
      let prevSectionIndex = s.currentSectionIndex;
      let prevFieldIndex = s.currentFieldIndex - 1;

      if (prevFieldIndex < 0) {
        prevSectionIndex--;
        if (prevSectionIndex >= 0) {
          prevFieldIndex = workflow.sections[prevSectionIndex].fields.length - 1;
        } else {
          return s;
        }
      }

      return {
        ...s,
        currentSectionIndex: prevSectionIndex,
        currentFieldIndex: prevFieldIndex,
        lastUpdatedAt: Date.now(),
      };
    });

    setInputValue('');
    setCurrentTranslation(null);
  }, [workflow]);

  // Export session (placeholder)
  const handleExport = useCallback(() => {
    console.log('Exporting session:', session);
    alert('Export functionality coming soon!');
  }, [session]);

  // Session completed view
  if (session.status === 'completed') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-hero">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-trust-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-trust-600" />
          </div>
          <h2 className="text-2xl font-display font-bold text-daraja-800 mb-2">
            Interview Complete
          </h2>
          <p className="text-daraja-600 mb-6">
            All {totalFields} fields have been completed.
          </p>

          <div className="space-y-3">
            <button onClick={handleExport} className="btn-primary w-full">
              <FileText className="w-5 h-5 mr-2" />
              Export PDF
            </button>
            <button onClick={() => navigate('/interview')} className="btn-secondary w-full">
              Start New Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Progress */}
      <div className="px-4 py-3 bg-white border-b border-daraja-100">
        <ProgressIndicator
          current={completedFields}
          total={totalFields}
          sectionName={currentSection?.title}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Current field card */}
        {currentField && (
          <FormCard
            field={currentField}
            sectionTitle={currentSection.title}
            value={inputValue}
            onChange={handleInputChange}
            onTranslate={handleTranslate}
            isTranslating={isTranslating}
          />
        )}

        {/* Voice input */}
        <div className="card">
          <VoiceInput
            onTranscriptionComplete={handleVoiceComplete}
            isProcessing={isTranslating}
            placeholder={currentField?.uiConfig?.promptHint}
          />
        </div>

        {/* Translation display */}
        {currentTranslation && (
          <TranslationDisplay translation={currentTranslation} />
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-16 bg-white border-t border-daraja-100 p-4 safe-bottom">
        <div className="flex gap-3">
          <button
            onClick={handlePrevious}
            disabled={session.currentSectionIndex === 0 && session.currentFieldIndex === 0}
            className="btn-secondary flex-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Previous
          </button>
          <button
            onClick={handleSaveAndNext}
            disabled={!inputValue.trim()}
            className="btn-primary flex-1"
          >
            {completedFields === totalFields - 1 ? 'Complete' : 'Next'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
}
