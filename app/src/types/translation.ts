/**
 * Translation types for Daraja
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  domain?: 'medical' | 'legal' | 'humanitarian' | 'general';
  context?: string;
}

export interface TranslationResponse {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  flaggedSegments: FlaggedSegment[];
  timestamp: number;
  latencyMs: number;
}

export interface FlaggedSegment {
  startIndex: number;
  endIndex: number;
  originalText: string;
  translatedText: string;
  confidence: number;
  reason: string;
}

export interface LanguagePair {
  id: string;
  source: LanguageInfo;
  target: LanguageInfo;
  modelName: string;
  status: 'available' | 'loading' | 'unavailable';
}

export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  script: 'Latin' | 'Arabic' | 'Ethiopic';
  direction: 'ltr' | 'rtl';
}

// Predefined language pairs
export const LANGUAGE_PAIRS: LanguagePair[] = [
  {
    id: 'so-sw',
    source: {
      code: 'so',
      name: 'Somali',
      nativeName: 'Soomaali',
      script: 'Latin',
      direction: 'ltr',
    },
    target: {
      code: 'sw',
      name: 'Swahili',
      nativeName: 'Kiswahili',
      script: 'Latin',
      direction: 'ltr',
    },
    modelName: 'daraja-so-sw',
    status: 'available',
  },
  {
    id: 'ti-ar',
    source: {
      code: 'ti',
      name: 'Tigrinya',
      nativeName: 'ትግርኛ',
      script: 'Ethiopic',
      direction: 'ltr',
    },
    target: {
      code: 'ar',
      name: 'Arabic',
      nativeName: 'العربية',
      script: 'Arabic',
      direction: 'rtl',
    },
    modelName: 'daraja-ti-ar',
    status: 'unavailable',
  },
  {
    id: 'prs-tr',
    source: {
      code: 'prs',
      name: 'Dari',
      nativeName: 'دری',
      script: 'Arabic',
      direction: 'rtl',
    },
    target: {
      code: 'tr',
      name: 'Turkish',
      nativeName: 'Türkçe',
      script: 'Latin',
      direction: 'ltr',
    },
    modelName: 'daraja-prs-tr',
    status: 'unavailable',
  },
];

/**
 * Calculate confidence level from numeric score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/**
 * Get confidence level color classes
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'bg-trust-100 text-trust-700';
    case 'medium':
      return 'bg-caution-100 text-caution-600';
    case 'low':
      return 'bg-alert-100 text-alert-600';
  }
}
