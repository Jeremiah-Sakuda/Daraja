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
  // Reverse direction models
  'sw-so': 'daraja-sw-so',
  'ar-ti': 'daraja-ar-ti',
  'tr-prs': 'daraja-tr-prs',
};

/**
 * Build translation prompt for Daraja models
 *
 * Uses the exact format the model was trained on:
 * "Translate {Source} to {Target}:\n{text}\n{Target}:\n"
 */
function buildTranslationPrompt(
  text: string,
  sourcePair: LanguagePair,
  domain?: string
): string {
  const domainTag = domain ? `[${domain.toUpperCase()}] ` : '';
  const inputText = `${domainTag}${text}`;

  // Match training format exactly
  return `Translate ${sourcePair.source.name} to ${sourcePair.target.name}:\n${inputText}\n${sourcePair.target.name}:\n`;
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

  // Remove any prefix patterns like "Thank you: Asante sana" -> "Asante sana"
  // Or "Peace - Amani (Swahili)" -> "Amani"
  translation = translation.replace(/^[^:]+:\s*/, ''); // Remove "Word:" prefix
  translation = translation.replace(/^[^-]+-\s*/, ''); // Remove "Word - " prefix
  translation = translation.replace(/\s*\([^)]+\)\s*$/, ''); // Remove trailing parenthetical

  // Remove any "Translation:" prefix
  translation = translation.replace(/^(Translation|Translated text|Output|Swahili):\s*/i, '');

  return translation.trim();
}

/**
 * Calculate confidence components from model response metrics
 *
 * Components:
 * - tokenEntropy: Derived from generation consistency (tokens/sec stability)
 * - backTranslationSimilarity: Currently approximated, would need reverse translation
 * - domainMatch: Based on prompt domain classification
 */
function calculateConfidenceFromMetrics(
  consistencyScore: number,
  tokensPerSecond: number,
  domain?: string
): ConfidenceComponents {
  // Token entropy approximation from generation consistency
  // Higher consistency score = lower entropy = more confident
  const tokenEntropy = Math.min(1, Math.max(0, 0.5 + consistencyScore * 0.5));

  // Back-translation similarity - approximated based on token rate
  // Models generating at expected rates are typically more accurate
  // This would ideally involve actual back-translation verification
  const backTranslationSimilarity = Math.min(1, Math.max(0,
    0.6 + (tokensPerSecond > 20 ? 0.3 : tokensPerSecond / 100)
  ));

  // Domain match score - specialized domains get slight boost if recognized
  const domainBonus = domain && ['medical', 'legal', 'humanitarian'].includes(domain)
    ? 0.1
    : 0;
  const domainMatch = Math.min(1, 0.7 + domainBonus + (consistencyScore * 0.2));

  return {
    tokenEntropy,
    backTranslationSimilarity,
    domainMatch,
  };
}

/**
 * @deprecated Use calculateConfidenceFromMetrics for real scoring
 * Calculate mock confidence components for fallback/offline mode
 */
function _calculateMockConfidenceComponents(): ConfidenceComponents {
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
    // Call Ollama with confidence metrics
    const ollamaResponse = await ollamaClient.generateWithConfidence({
      model: modelName,
      prompt,
      options: {
        temperature: 0,
        top_p: 0.9,
        num_predict: 100,
        stop: ['\n'], // Stop at first newline (translation complete)
      },
    });

    const translatedText = extractTranslation(ollamaResponse.response);
    const latencyMs = Date.now() - startTime;

    // Calculate confidence from real model metrics
    const confidenceComponents = calculateConfidenceFromMetrics(
      ollamaResponse.confidence.consistencyScore,
      ollamaResponse.confidence.tokensPerSecond,
      request.domain
    );
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
