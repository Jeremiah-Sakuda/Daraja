import { ArrowRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { TranslationResponse } from '../../types/translation';
import { ConfidenceBadge } from './ConfidenceBadge';

interface TranslationDisplayProps {
  translation: TranslationResponse;
  showDetails?: boolean;
}

export function TranslationDisplay({
  translation,
  showDetails = true,
}: TranslationDisplayProps) {
  const { sourceText, translatedText, confidenceLevel, confidence, latencyMs } = translation;

  return (
    <div className="card animate-slide-up space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-daraja-700">Translation</h4>
        <ConfidenceBadge level={confidenceLevel} score={confidence} />
      </div>

      {/* Source text */}
      <div className="translation-source">
        <p className="text-sm font-medium text-daraja-500 mb-1">Original</p>
        <p className="text-daraja-800">{sourceText}</p>
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowRight className="w-5 h-5 text-daraja-400" />
      </div>

      {/* Translated text */}
      <div className="translation-target">
        <p className="text-sm font-medium text-daraja-500 mb-1">Translated</p>
        <p className="text-daraja-900 text-lg">{translatedText}</p>
      </div>

      {/* Confidence warning */}
      {confidenceLevel === 'low' && (
        <div className="flex items-start gap-3 p-3 bg-alert-50 rounded-xl border border-alert-200">
          <AlertTriangle className="w-5 h-5 text-alert-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-alert-700">Low confidence translation</p>
            <p className="text-sm text-alert-600">
              This translation has been flagged for human review. Please verify accuracy
              before proceeding.
            </p>
          </div>
        </div>
      )}

      {confidenceLevel === 'medium' && (
        <div className="flex items-start gap-3 p-3 bg-caution-50 rounded-xl border border-caution-200">
          <AlertTriangle className="w-5 h-5 text-caution-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-caution-700">Review recommended</p>
            <p className="text-sm text-caution-600">
              Consider verifying this translation, especially for critical information.
            </p>
          </div>
        </div>
      )}

      {confidenceLevel === 'high' && (
        <div className="flex items-start gap-3 p-3 bg-trust-50 rounded-xl border border-trust-200">
          <CheckCircle className="w-5 h-5 text-trust-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-trust-700">
            High confidence translation
          </p>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="flex items-center justify-between pt-2 border-t border-daraja-100">
          <div className="flex items-center gap-1 text-xs text-daraja-400">
            <Clock className="w-3 h-3" />
            <span>{latencyMs}ms</span>
          </div>
          <span className="text-xs text-daraja-400">
            Confidence: {Math.round(confidence * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
