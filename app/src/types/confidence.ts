/**
 * Confidence scoring types and utilities
 */

export interface ConfidenceScore {
  overall: number;
  components: ConfidenceComponents;
  level: ConfidenceLevel;
  shouldFlag: boolean;
  flagReasons: string[];
}

export interface ConfidenceComponents {
  tokenEntropy: number;
  backTranslationSimilarity: number;
  domainMatch: number;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceThresholds {
  high: number;
  medium: number;
}

export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
  high: 0.8,
  medium: 0.5,
};

export const CONFIDENCE_WEIGHTS = {
  tokenEntropy: 0.3,
  backTranslationSimilarity: 0.5,
  domainMatch: 0.2,
};

/**
 * Calculate weighted confidence score
 */
export function calculateConfidence(components: ConfidenceComponents): number {
  return (
    components.tokenEntropy * CONFIDENCE_WEIGHTS.tokenEntropy +
    components.backTranslationSimilarity * CONFIDENCE_WEIGHTS.backTranslationSimilarity +
    components.domainMatch * CONFIDENCE_WEIGHTS.domainMatch
  );
}

/**
 * Determine confidence level from score
 */
export function getConfidenceLevel(
  score: number,
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS
): ConfidenceLevel {
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.medium) return 'medium';
  return 'low';
}

/**
 * Determine if translation should be flagged for review
 */
export function shouldFlagForReview(
  score: number,
  thresholds: ConfidenceThresholds = DEFAULT_THRESHOLDS
): boolean {
  return score < thresholds.medium;
}

/**
 * Get human-readable confidence description
 */
export function getConfidenceDescription(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'High confidence - translation appears accurate';
    case 'medium':
      return 'Medium confidence - review recommended';
    case 'low':
      return 'Low confidence - human review required';
  }
}

/**
 * Get confidence badge color classes
 */
export function getConfidenceBadgeClasses(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'badge-confidence high';
    case 'medium':
      return 'badge-confidence medium';
    case 'low':
      return 'badge-confidence low';
  }
}

/**
 * Create a mock confidence score for testing
 */
export function createMockConfidenceScore(overallScore: number): ConfidenceScore {
  const level = getConfidenceLevel(overallScore);
  const shouldFlag = shouldFlagForReview(overallScore);

  return {
    overall: overallScore,
    components: {
      tokenEntropy: overallScore + (Math.random() * 0.1 - 0.05),
      backTranslationSimilarity: overallScore + (Math.random() * 0.1 - 0.05),
      domainMatch: overallScore + (Math.random() * 0.1 - 0.05),
    },
    level,
    shouldFlag,
    flagReasons: shouldFlag ? ['Low overall confidence score'] : [],
  };
}
