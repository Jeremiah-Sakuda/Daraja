import { useState, useCallback, useEffect } from 'react';
import type { TranslationRequest, TranslationResponse, LanguagePair } from '../types/translation';
import { getConfidenceLevel, LANGUAGE_PAIRS } from '../types/translation';
import { createMockConfidenceScore } from '../types/confidence';

interface OllamaState {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  availableModels: string[];
  currentModel: string | null;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

const OLLAMA_BASE_URL = '/api/ollama';

export function useOllama() {
  const [state, setState] = useState<OllamaState>({
    isConnected: false,
    isLoading: false,
    error: null,
    availableModels: [],
    currentModel: null,
  });

  const [selectedPair, setSelectedPair] = useState<LanguagePair>(LANGUAGE_PAIRS[0]);

  // Check Ollama connection and list models
  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
      if (!response.ok) throw new Error('Ollama not available');

      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];

      setState((s) => ({
        ...s,
        isConnected: true,
        availableModels: models,
        error: null,
      }));

      return true;
    } catch {
      setState((s) => ({
        ...s,
        isConnected: false,
        error: 'Cannot connect to Ollama. Make sure Ollama is running.',
      }));
      return false;
    }
  }, []);

  // Check connection on mount
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Load a specific model
  const loadModel = useCallback(
    async (modelName: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        // Pull model if not available
        if (!state.availableModels.includes(modelName)) {
          const pullResponse = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName }),
          });

          if (!pullResponse.ok) {
            throw new Error(`Failed to pull model: ${modelName}`);
          }
        }

        setState((s) => ({
          ...s,
          isLoading: false,
          currentModel: modelName,
        }));

        return true;
      } catch (err) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load model',
        }));
        return false;
      }
    },
    [state.availableModels]
  );

  // Generate translation
  const translate = useCallback(
    async (request: TranslationRequest): Promise<TranslationResponse | null> => {
      const startTime = Date.now();

      // Find appropriate model
      const pair = LANGUAGE_PAIRS.find(
        (p) => p.source.code === request.sourceLang && p.target.code === request.targetLang
      );

      const modelName = pair?.modelName || state.currentModel || 'daraja-so-sw';

      // Build translation prompt
      const domainTag = request.domain ? `[${request.domain.toUpperCase()}]` : '';
      const prompt = `Translate the following ${pair?.source.name || 'source'} text to ${pair?.target.name || 'target'}:
${domainTag} ${request.text}`;

      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const generateRequest: OllamaGenerateRequest = {
          model: modelName,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
          },
        };

        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(generateRequest),
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data: OllamaGenerateResponse = await response.json();
        const latencyMs = Date.now() - startTime;

        // Extract translation (remove any leading/trailing whitespace)
        const translatedText = data.response.trim();

        // Calculate mock confidence (in production, this would be computed properly)
        const confidenceScore = createMockConfidenceScore(0.75 + Math.random() * 0.2);

        const result: TranslationResponse = {
          id: `tr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          sourceText: request.text,
          translatedText,
          sourceLang: request.sourceLang,
          targetLang: request.targetLang,
          confidence: confidenceScore.overall,
          confidenceLevel: confidenceScore.level,
          flaggedSegments: [],
          timestamp: Date.now(),
          latencyMs,
        };

        setState((s) => ({ ...s, isLoading: false }));
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Translation failed';
        setState((s) => ({
          ...s,
          isLoading: false,
          error: errorMessage,
        }));

        // Return mock response for offline/demo mode
        if (!state.isConnected) {
          const mockConfidence = createMockConfidenceScore(0.7);
          return {
            id: `tr-mock-${Date.now()}`,
            sourceText: request.text,
            translatedText: `[Mock translation of: ${request.text}]`,
            sourceLang: request.sourceLang,
            targetLang: request.targetLang,
            confidence: mockConfidence.overall,
            confidenceLevel: mockConfidence.level,
            flaggedSegments: [],
            timestamp: Date.now(),
            latencyMs: Date.now() - startTime,
          };
        }

        return null;
      }
    },
    [state.currentModel, state.isConnected]
  );

  // Quick translate (simpler interface)
  const quickTranslate = useCallback(
    async (text: string, domain?: string): Promise<string> => {
      const response = await translate({
        text,
        sourceLang: selectedPair.source.code,
        targetLang: selectedPair.target.code,
        domain: domain as TranslationRequest['domain'],
      });

      return response?.translatedText || '';
    },
    [translate, selectedPair]
  );

  // Select language pair
  const selectLanguagePair = useCallback((pairId: string) => {
    const pair = LANGUAGE_PAIRS.find((p) => p.id === pairId);
    if (pair) {
      setSelectedPair(pair);
    }
  }, []);

  return {
    ...state,
    selectedPair,
    languagePairs: LANGUAGE_PAIRS,
    checkConnection,
    loadModel,
    translate,
    quickTranslate,
    selectLanguagePair,
  };
}
