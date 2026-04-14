import { Shield, AlertCircle, AlertTriangle } from 'lucide-react';
import type { ConfidenceLevel } from '../../types/translation';

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceBadge({
  level,
  score,
  showScore = false,
  size = 'md',
}: ConfidenceBadgeProps) {
  const config = {
    high: {
      label: 'High',
      icon: Shield,
      classes: 'bg-trust-100 text-trust-700 border-trust-200',
    },
    medium: {
      label: 'Medium',
      icon: AlertTriangle,
      classes: 'bg-caution-100 text-caution-600 border-caution-200',
    },
    low: {
      label: 'Low',
      icon: AlertCircle,
      classes: 'bg-alert-100 text-alert-600 border-alert-200',
    },
  };

  const { label, icon: Icon, classes } = config[level];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${classes}
        ${sizeClasses[size]}
      `}
    >
      <Icon className={iconSizes[size]} />
      <span>{label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75">({Math.round(score * 100)}%)</span>
      )}
    </span>
  );
}
