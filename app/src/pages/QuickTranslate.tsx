import { useState, useCallback } from 'react';
import { ArrowRightLeft, Languages, Loader2, Copy, Check, Volume2 } from 'lucide-react';
import { VoiceInput } from '../components/input/VoiceInput';
import { TextInput } from '../components/input/TextInput';
import { ConfidenceBadge } from '../components/translation/ConfidenceBadge';
import { LANGUAGE_PAIRS } from '../types/translation';
import type { ConfidenceLevel } from '../types/translation';

interface TranslationResult {
  sourceText: string;
  translatedText: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  timestamp: number;
}

export function QuickTranslate() {
  const [sourceLang, setSourceLang] = useState('so');
  const [targetLang, setTargetLang] = useState('sw');
  const [inputText, setInputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const activePair = LANGUAGE_PAIRS.find(
    (p) => p.source.code === sourceLang && p.target.code === targetLang
  );

  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText('');
    setResult(null);
  }, [sourceLang, targetLang]);

  const handleTranslate = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsTranslating(true);
    setResult(null);

    try {
      // Simulate translation (in production, this calls Ollama)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock result
      const mockConfidence = 0.7 + Math.random() * 0.25;
      const confidenceLevel: ConfidenceLevel =
        mockConfidence >= 0.8 ? 'high' : mockConfidence >= 0.5 ? 'medium' : 'low';

      setResult({
        sourceText: text,
        translatedText: `[Translation of: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"]`,
        confidence: mockConfidence,
        confidenceLevel,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setIsTranslating(false);
    }
  }, []);

  const handleVoiceTranscription = useCallback((text: string) => {
    setInputText(text);
    handleTranslate(text);
  }, [handleTranslate]);

  const handleCopyTranslation = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const getLanguageName = (code: string): string => {
    for (const pair of LANGUAGE_PAIRS) {
      if (pair.source.code === code) return pair.source.name;
      if (pair.target.code === code) return pair.target.name;
    }
    return code;
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6">
      <div>
        <h1 className="section-header">Quick Translate</h1>
        <p className="text-sm text-daraja-500">
          Translate text or speech without a structured workflow
        </p>
      </div>

      {/* Language selector */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <label className="form-label">From</label>
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="input-field"
            >
              <option value="so">Somali</option>
              <option value="ti" disabled>Tigrinya (soon)</option>
              <option value="prs" disabled>Dari (soon)</option>
            </select>
          </div>

          <button
            onClick={handleSwapLanguages}
            className="btn-icon mt-6"
            aria-label="Swap languages"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <label className="form-label">To</label>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="input-field"
            >
              <option value="sw">Swahili</option>
              <option value="ar" disabled>Arabic (soon)</option>
              <option value="tr" disabled>Turkish (soon)</option>
            </select>
          </div>
        </div>

        {activePair?.status !== 'available' && (
          <p className="text-sm text-caution-600 mt-3 text-center">
            This language pair is coming soon
          </p>
        )}
      </div>

      {/* Input section */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-daraja-700 uppercase tracking-wide">
          Enter text or speak
        </h2>

        <TextInput
          value={inputText}
          onChange={setInputText}
          onTranslate={handleTranslate}
          placeholder={`Type in ${getLanguageName(sourceLang)}...`}
          multiline
          maxLength={500}
          isTranslating={isTranslating}
        />

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-daraja-200" />
          <span className="text-sm text-daraja-400">OR</span>
          <div className="flex-1 h-px bg-daraja-200" />
        </div>

        <div className="flex justify-center">
          <VoiceInput
            onTranscriptionComplete={handleVoiceTranscription}
            isProcessing={isTranslating}
            placeholder={`Speak in ${getLanguageName(sourceLang)}`}
          />
        </div>
      </div>

      {/* Translation button */}
      {inputText && !isTranslating && !result && (
        <button
          onClick={() => handleTranslate(inputText)}
          className="btn-primary w-full"
        >
          <Languages className="w-5 h-5 mr-2" />
          Translate to {getLanguageName(targetLang)}
        </button>
      )}

      {/* Loading state */}
      {isTranslating && (
        <div className="card flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-daraja-500 animate-spin" />
          <span className="ml-3 text-daraja-600">Translating...</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-daraja-700 uppercase tracking-wide">
              Translation
            </h2>
            <ConfidenceBadge
              level={result.confidenceLevel}
              score={result.confidence}
            />
          </div>

          {/* Source */}
          <div className="translation-source">
            <div className="text-xs text-daraja-500 mb-1">
              {getLanguageName(sourceLang)}
            </div>
            <p className="text-daraja-800">{result.sourceText}</p>
          </div>

          {/* Target */}
          <div className="translation-target">
            <div className="text-xs text-daraja-500 mb-1">
              {getLanguageName(targetLang)}
            </div>
            <p className="text-daraja-900">{result.translatedText}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCopyTranslation}
              className="btn-secondary flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </button>

            <button className="btn-secondary flex-1" disabled>
              <Volume2 className="w-4 h-4 mr-2" />
              Listen
            </button>
          </div>

          {/* Low confidence warning */}
          {result.confidenceLevel === 'low' && (
            <div className="p-4 rounded-xl bg-alert-50 border border-alert-200">
              <p className="text-sm text-alert-700">
                <strong>Low confidence translation.</strong> Please verify with
                a qualified interpreter for important communications.
              </p>
            </div>
          )}

          {/* New translation button */}
          <button
            onClick={() => {
              setInputText('');
              setResult(null);
            }}
            className="btn-ghost w-full"
          >
            New Translation
          </button>
        </div>
      )}
    </div>
  );
}
