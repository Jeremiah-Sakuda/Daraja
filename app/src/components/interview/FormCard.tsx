import { Languages, Loader2 } from 'lucide-react';
import type { WorkflowField } from '../../types/workflow';

interface FormCardProps {
  field: WorkflowField;
  sectionTitle: string;
  value: string;
  onChange: (value: string) => void;
  onTranslate: () => void;
  isTranslating: boolean;
}

export function FormCard({
  field,
  sectionTitle,
  value,
  onChange,
  onTranslate,
  isTranslating,
}: FormCardProps) {
  const isLongText = field.type === 'longText';

  return (
    <div className="card animate-fade-in">
      {/* Section badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-daraja-500 uppercase tracking-wide">
          {sectionTitle}
        </span>
        {field.required && (
          <span className="text-xs text-alert-500">Required</span>
        )}
      </div>

      {/* Field label */}
      <h3 className="text-xl font-display font-semibold text-daraja-800 mb-2">
        {field.label}
      </h3>

      {/* Prompt hint */}
      {field.uiConfig?.promptHint && (
        <p className="text-sm text-daraja-500 mb-4 italic">
          "{field.uiConfig.promptHint}"
        </p>
      )}

      {/* Help text */}
      {field.helpText && (
        <p className="text-sm text-daraja-600 mb-4">
          {field.helpText}
        </p>
      )}

      {/* Input field */}
      <div className="space-y-3">
        {isLongText ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Enter your response...'}
            className="textarea-field"
            rows={4}
          />
        ) : (
          <input
            type={field.type === 'date' ? 'date' : 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Enter your response...'}
            className="input-field"
          />
        )}

        {/* Translate button */}
        {value.trim() && (
          <button
            onClick={onTranslate}
            disabled={isTranslating}
            className="btn-secondary w-full"
          >
            {isTranslating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <Languages className="w-5 h-5 mr-2" />
                Translate
              </>
            )}
          </button>
        )}
      </div>

      {/* Translation priority indicator */}
      {field.uiConfig?.translationPriority === 'critical' && (
        <div className="mt-4 p-3 bg-caution-50 rounded-xl border border-caution-200">
          <p className="text-xs text-caution-700">
            <strong>High priority field:</strong> This response will be carefully reviewed
            for translation accuracy.
          </p>
        </div>
      )}
    </div>
  );
}
