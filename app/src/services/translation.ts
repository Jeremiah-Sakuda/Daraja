/**
 * Translation orchestration service
 */

import { ollamaClient } from './ollama';
import type {
  TranslationRequest,
  TranslationResponse,
  LanguagePair,
} from '../types/translation';
import { getConfidenceLevel, LANGUAGE_PAIRS } from '../types/translation';
import { calculateConfidence, type ConfidenceComponents } from '../types/confidence';

const DARAJA_MODELS: Record<string, string> = {
  'so-sw': 'daraja-so-sw',
  'ti-ar': 'daraja-ti-ar',
  'prs-tr': 'daraja-prs-tr',
};

/**
 * Build translation prompt for Daraja models
 */
function buildTranslationPrompt(
  text: string,
  sourcePair: LanguagePair,
  domain?: string
): string {
  const domainTag = domain ? `[${domain.toUpperCase()}] ` : '';

  return `Translate the following ${sourcePair.source.name} text to ${sourcePair.target.name}:
${domainTag}${text}`;
}

/**
 * Extract translation from model response
 */
function extractTranslation(response: string): string {
  // Clean up common model artifacts
  let translation = response.trim();

  // Remove any leading quotes or artifacts
  if (translation.startsWith('"') && translation.endsWith('"')) {
    translation = translation.slice(1, -1);
  }

  // Remove any "Translation:" prefix
  translation = translation.replace(/^(Translation|Translated text|Output):\s*/i, '');

  return translation.trim();
}

/**
 * Calculate mock confidence components
 * In production, these would be computed from:
 * - Token-level entropy from the model
 * - Back-translation similarity
 * - Domain classifier scores
 */
function calculateMockConfidenceComponents(): ConfidenceComponents {
  // Simulate realistic confidence scores
  const baseScore = 0.7 + Math.random() * 0.25;

  return {
    tokenEntropy: baseScore + (Math.random() * 0.1 - 0.05),
    backTranslationSimilarity: baseScore + (Math.random() * 0.1 - 0.05),
    domainMatch: baseScore + (Math.random() * 0.1 - 0.05),
  };
}

/**
 * Main translation function
 */
export async function translate(
  request: TranslationRequest
): Promise<TranslationResponse> {
  const startTime = Date.now();

  // Find the appropriate language pair
  const pair = LANGUAGE_PAIRS.find(
    (p) => p.source.code === request.sourceLang && p.target.code === request.targetLang
  );

  if (!pair) {
    throw new Error(
      `Unsupported language pair: ${request.sourceLang} -> ${request.targetLang}`
    );
  }

  // Get the model name
  const pairKey = `${request.sourceLang}-${request.targetLang}`;
  const modelName = DARAJA_MODELS[pairKey] || 'daraja-so-sw';

  // Build the prompt
  const prompt = buildTranslationPrompt(request.text, pair, request.domain);

  try {
    // Call Ollama
    const ollamaResponse = await ollamaClient.generate({
      model: modelName,
      prompt,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 256,
      },
    });

    const translatedText = extractTranslation(ollamaResponse.response);
    const latencyMs = Date.now() - startTime;

    // Calculate confidence
    const confidenceComponents = calculateMockConfidenceComponents();
    const confidence = calculateConfidence(confidenceComponents);
    const confidenceLevel = getConfidenceLevel(confidence);

    // Identify flagged segments (simplified for demo)
    const flaggedSegments = confidenceLevel === 'low'
      ? [{
          startIndex: 0,
          endIndex: translatedText.length,
          originalText: request.text,
          translatedText,
          confidence,
          reason: 'Low overall confidence',
        }]
      : [];

    return {
      id: `tr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      sourceText: request.text,
      translatedText,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      confidence,
      confidenceLevel,
      flaggedSegments,
      timestamp: Date.now(),
      latencyMs,
    };
  } catch (error) {
    // Return mock translation for offline/demo mode
    const latencyMs = Date.now() - startTime;
    const mockConfidence = 0.65;

    return {
      id: `tr-mock-${Date.now()}`,
      sourceText: request.text,
      translatedText: `[Offline - ${pair.target.name} translation pending]`,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      confidence: mockConfidence,
      confidenceLevel: getConfidenceLevel(mockConfidence),
      flaggedSegments: [],
      timestamp: Date.now(),
      latencyMs,
    };
  }
}

/**
 * Batch translate multiple texts
 */
export async function translateBatch(
  requests: TranslationRequest[]
): Promise<TranslationResponse[]> {
  // Process in parallel with concurrency limit
  const results: TranslationResponse[] = [];
  const concurrency = 3;

  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(translate));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Check if Ollama is available with required models
 */
export async function checkTranslationService(): Promise<{
  available: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const available = await ollamaClient.isAvailable();
    if (!available) {
      return {
        available: false,
        models: [],
        error: 'Ollama is not running',
      };
    }

    const allModels = await ollamaClient.listModels();
    const darajaModels = allModels
      .filter((m) => m.name.startsWith('daraja'))
      .map((m) => m.name);

    return {
      available: true,
      models: darajaModels,
    };
  } catch (error) {
    return {
      available: false,
      models: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
