import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  /**
   * Label displayed below the value
   */
  label: string;

  /**
   * The main statistic value (number or string like "94%")
   */
  value: string | number;

  /**
   * Lucide icon component
   */
  icon: LucideIcon;

  /**
   * Tailwind color class for the icon (e.g., "text-blue-600")
   */
  color: string;

  /**
   * Tailwind background class for the icon container (e.g., "bg-blue-50")
   */
  bg: string;

  /**
   * Optional onClick handler
   */
  onClick?: () => void;
}

/**
 * A reusable stat card component for dashboards
 * Displays a single statistic with icon, value, and label
 */
export function StatCard({ label, value, icon: Icon, color, bg, onClick }: StatCardProps) {
  const card = (
    <div
      className={`bg-white p-6 rounded-xl border border-gray-200 shadow-sm ${onClick ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`${bg} p-3 rounded-lg`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  return card;
}

/**
 * Props for the stat card configuration
 */
export interface StatCardConfig {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
}

/**
 * A grid container for multiple stat cards
 */
interface StatsGridProps {
  stats: StatCardConfig[];
  className?: string;
}

export function StatsGrid({ stats, className = '' }: StatsGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
