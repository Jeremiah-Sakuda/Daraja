import type { FlaggedSegment as FlaggedSegmentType } from '../../types/translation';

interface FlaggedSegmentProps {
  segment: FlaggedSegmentType;
  onClick?: () => void;
}

export function FlaggedSegment({ segment, onClick }: FlaggedSegmentProps) {
  return (
    <span
      className="flagged-segment cursor-pointer hover:bg-caution-100 rounded px-0.5 transition-colors"
      onClick={onClick}
      title={`Confidence: ${Math.round(segment.confidence * 100)}% - ${segment.reason}`}
    >
      {segment.translatedText}
    </span>
  );
}
