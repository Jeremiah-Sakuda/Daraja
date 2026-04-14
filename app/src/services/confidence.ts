/**
 * Confidence Scoring Service
 *
 * Implements confidence routing algorithm:
 * - confidence >= 0.8 → Show directly (HIGH)
 * - 0.5 <= confidence < 0.8 → Show with warning (MEDIUM)
 * - confidence < 0.5 → Withhold, flag for review (LOW)
 *
 * Score calculation:
 * confidence = weighted_average(
 *   token_entropy_score * 0.3,
 *   back_translation_similarity * 0.5,
 *   domain_match_score * 0.2
 * )
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceScore {
  overall: number;
  level: ConfidenceLevel;
  components: {
    tokenEntropy: number;
    backTranslationSimilarity: number;
    domainMatch: number;
  };
  flags: ConfidenceFlag[];
}

export interface ConfidenceFlag {
  type: 'low_confidence' | 'domain_mismatch' | 'length_anomaly' | 'unknown_tokens' | 'ambiguous';
  severity: 'warning' | 'critical';
  message: string;
  segment?: {
    start: number;
    end: number;
    text: string;
  };
}

export interface ConfidenceConfig {
  highThreshold: number;
  mediumThreshold: number;
  weights: {
    tokenEntropy: number;
    backTranslationSimilarity: number;
    domainMatch: number;
  };
}

const DEFAULT_CONFIG: ConfidenceConfig = {
  highThreshold: 0.8,
  mediumThreshold: 0.5,
  weights: {
    tokenEntropy: 0.3,
    backTranslationSimilarity: 0.5,
    domainMatch: 0.2,
  },
};

/**
 * Calculate token entropy score from model logits/probabilities
 * Low entropy = high confidence (model is certain)
 * Returns normalized score 0-1 where 1 is highest confidence
 */
export function calculateTokenEntropyScore(
  tokenProbabilities: number[]
): number {
  if (!tokenProbabilities.length) return 0.5;

  // Calculate average entropy across tokens
  let totalEntropy = 0;
  for (const prob of tokenProbabilities) {
    // Entropy: -p * log(p)
    if (prob > 0 && prob < 1) {
      totalEntropy += -prob * Math.log2(prob);
    }
  }

  const avgEntropy = totalEntropy / tokenProbabilities.length;

  // Normalize: entropy of 0 = score of 1, entropy of 3+ = score near 0
  // Using sigmoid-like transformation
  const normalizedScore = 1 / (1 + avgEntropy);

  return Math.max(0, Math.min(1, normalizedScore));
}

/**
 * Calculate semantic similarity between original and back-translation
 * Using cosine similarity of embeddings (simplified version)
 */
export function calculateBackTranslationSimilarity(
  original: string,
  backTranslation: string
): number {
  if (!original || !backTranslation) return 0;

  // Simplified string similarity (in production, use LaBSE embeddings)
  const originalWords = new Set(original.toLowerCase().split(/\s+/));
  const backWords = new Set(backTranslation.toLowerCase().split(/\s+/));

  // Jaccard similarity as proxy
  const intersection = new Set([...originalWords].filter((x) => backWords.has(x)));
  const union = new Set([...originalWords, ...backWords]);

  if (union.size === 0) return 0;

  const jaccardSimilarity = intersection.size / union.size;

  // Weight longer matches higher
  const lengthRatio = Math.min(original.length, backTranslation.length) /
    Math.max(original.length, backTranslation.length);

  return jaccardSimilarity * 0.7 + lengthRatio * 0.3;
}

/**
 * Calculate domain match score
 * Higher score if translation request matches expected domain
 */
export function calculateDomainMatchScore(
  text: string,
  expectedDomain: string
): number {
  const domainKeywords: Record<string, string[]> = {
    medical: [
      'pain', 'fever', 'medication', 'hospital', 'doctor', 'treatment',
      'symptoms', 'diagnosis', 'health', 'injury', 'disease', 'medicine',
      'clinic', 'nurse', 'blood', 'heart', 'pregnant', 'child', 'vaccine',
    ],
    legal: [
      'asylum', 'refugee', 'persecution', 'protection', 'visa', 'document',
      'application', 'status', 'interview', 'authority', 'government',
      'rights', 'lawyer', 'court', 'declaration', 'testimony', 'evidence',
    ],
    humanitarian: [
      'family', 'home', 'country', 'travel', 'journey', 'camp', 'shelter',
      'food', 'water', 'safety', 'children', 'education', 'work', 'help',
      'registration', 'assistance', 'support', 'community',
    ],
    general: [],
  };

  const textLower = text.toLowerCase();
  const keywords = domainKeywords[expectedDomain] || [];

  if (keywords.length === 0) return 0.7; // Default score for general domain

  let matchCount = 0;
  for (const keyword of keywords) {
    if (textLower.includes(keyword)) {
      matchCount++;
    }
  }

  // Normalize by expected matches (assume 1-2 keywords per short text)
  const expectedMatches = Math.max(1, Math.floor(text.split(/\s+/).length / 10));
  const score = Math.min(1, matchCount / expectedMatches);

  return score * 0.8 + 0.2; // Base score of 0.2
}

/**
 * Detect potential issues in translation
 */
export function detectFlags(
  source: string,
  translation: string,
  confidence: number,
  domain: string
): ConfidenceFlag[] {
  const flags: ConfidenceFlag[] = [];

  // Low overall confidence
  if (confidence < 0.5) {
    flags.push({
      type: 'low_confidence',
      severity: 'critical',
      message: 'Translation confidence is very low. Human review recommended.',
    });
  } else if (confidence < 0.7) {
    flags.push({
      type: 'low_confidence',
      severity: 'warning',
      message: 'Translation confidence is moderate. Please verify accuracy.',
    });
  }

  // Length anomaly (translation much longer/shorter than source)
  const lengthRatio = translation.length / source.length;
  if (lengthRatio > 3 || lengthRatio < 0.3) {
    flags.push({
      type: 'length_anomaly',
      severity: 'warning',
      message: 'Translation length differs significantly from source.',
    });
  }

  // Check for untranslated segments (words that appear in both)
  const sourceWords = source.toLowerCase().split(/\s+/);
  const translationWords = translation.toLowerCase().split(/\s+/);
  const untranslated = sourceWords.filter(
    (w) => w.length > 3 && translationWords.includes(w)
  );

  if (untranslated.length > 2) {
    flags.push({
      type: 'unknown_tokens',
      severity: 'warning',
      message: `Possible untranslated words: ${untranslated.slice(0, 3).join(', ')}`,
    });
  }

  // Domain mismatch for critical domains
  if (['medical', 'legal'].includes(domain)) {
    const domainScore = calculateDomainMatchScore(source, domain);
    if (domainScore < 0.4) {
      flags.push({
        type: 'domain_mismatch',
        severity: 'warning',
        message: `Content may not match ${domain} domain expectations.`,
      });
    }
  }

  return flags;
}

/**
 * Calculate overall confidence score
 */
export function calculateConfidence(
  source: string,
  translation: string,
  options: {
    tokenProbabilities?: number[];
    backTranslation?: string;
    domain?: string;
    config?: Partial<ConfidenceConfig>;
  } = {}
): ConfidenceScore {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const domain = options.domain || 'general';

  // Calculate component scores
  const tokenEntropy = options.tokenProbabilities
    ? calculateTokenEntropyScore(options.tokenProbabilities)
    : 0.7; // Default if no probabilities available

  const backTranslationSimilarity = options.backTranslation
    ? calculateBackTranslationSimilarity(source, options.backTranslation)
    : 0.6; // Default if no back-translation

  const domainMatch = calculateDomainMatchScore(source, domain);

  // Calculate weighted overall score
  const overall =
    tokenEntropy * config.weights.tokenEntropy +
    backTranslationSimilarity * config.weights.backTranslationSimilarity +
    domainMatch * config.weights.domainMatch;

  // Determine confidence level
  let level: ConfidenceLevel;
  if (overall >= config.highThreshold) {
    level = 'high';
  } else if (overall >= config.mediumThreshold) {
    level = 'medium';
  } else {
    level = 'low';
  }

  // Detect flags
  const flags = detectFlags(source, translation, overall, domain);

  return {
    overall,
    level,
    components: {
      tokenEntropy,
      backTranslationSimilarity,
      domainMatch,
    },
    flags,
  };
}

/**
 * Get routing recommendation based on confidence
 */
export function getRoutingRecommendation(score: ConfidenceScore): {
  action: 'show' | 'show_with_warning' | 'flag_for_review';
  message: string;
} {
  switch (score.level) {
    case 'high':
      return {
        action: 'show',
        message: 'Translation is confident and can be shown directly.',
      };
    case 'medium':
      return {
        action: 'show_with_warning',
        message: 'Translation should be shown with a confidence warning.',
      };
    case 'low':
      return {
        action: 'flag_for_review',
        message: 'Translation confidence is low. Flag for human review.',
      };
  }
}

/**
 * Format confidence for display
 */
export function formatConfidence(score: ConfidenceScore): {
  percentage: string;
  label: string;
  color: string;
} {
  const percentage = `${Math.round(score.overall * 100)}%`;

  const labels: Record<ConfidenceLevel, string> = {
    high: 'High Confidence',
    medium: 'Medium Confidence',
    low: 'Low Confidence',
  };

  const colors: Record<ConfidenceLevel, string> = {
    high: 'text-success-600',
    medium: 'text-caution-600',
    low: 'text-alert-600',
  };

  return {
    percentage,
    label: labels[score.level],
    color: colors[score.level],
  };
}
