interface ProgressBarProps {
  /**
   * Progress percentage (0-100)
   */
  progress: number;

  /**
   * Current status for color styling
   */
  status?: 'running' | 'passed' | 'failed' | 'pending';

  /**
   * Height of the progress bar (default: "h-3")
   */
  height?: string;

  /**
   * Show percentage text
   */
  showPercentage?: boolean;

  /**
   * Optional label text
   */
  label?: string;

  /**
   * Completed count for label (e.g., "5/10 steps")
   */
  completed?: number;

  /**
   * Total count for label
   */
  total?: number;
}

const statusColors: Record<string, string> = {
  running: 'bg-blue-500',
  passed: 'bg-green-500',
  failed: 'bg-red-500',
  pending: 'bg-gray-400',
};

/**
 * A reusable progress bar component with status-based coloring
 */
export function ProgressBar({
  progress,
  status = 'running',
  height = 'h-3',
  showPercentage = false,
  label,
  completed,
  total,
}: ProgressBarProps) {
  const barColor = statusColors[status] || statusColors.running;

  return (
    <div className="w-full">
      {(label || showPercentage || (completed !== undefined && total !== undefined)) && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {label && label}
            {completed !== undefined && total !== undefined && (
              <> {completed}/{total} steps</>
            )}
          </span>
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${height}`}>
        <div
          className={`${height} rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
