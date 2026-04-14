interface ProgressIndicatorProps {
  current: number;
  total: number;
  sectionName?: string;
}

export function ProgressIndicator({ current, total, sectionName }: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-daraja-700">
          {sectionName || 'Progress'}
        </span>
        <span className="text-daraja-500">
          {current} of {total} ({percentage}%)
        </span>
      </div>
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
