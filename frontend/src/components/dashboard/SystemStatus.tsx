import { CheckCircle, Clock, AlertCircle, XCircle, LucideIcon } from 'lucide-react';

type StatusType = 'success' | 'info' | 'warning' | 'error';

interface StatusItemProps {
  /**
   * Type of status for styling
   */
  type: StatusType;

  /**
   * Status message to display
   */
  message: string;

  /**
   * Optional custom icon
   */
  icon?: LucideIcon;
}

const statusConfig: Record<StatusType, { icon: LucideIcon; bg: string; text: string; border: string }> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-100',
  },
  info: {
    icon: Clock,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-100',
  },
  warning: {
    icon: AlertCircle,
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-100',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-100',
  },
};

/**
 * Individual status item component
 */
export function StatusItem({ type, message, icon: CustomIcon }: StatusItemProps) {
  const config = statusConfig[type];
  const Icon = CustomIcon || config.icon;

  return (
    <div
      className={`flex items-center space-x-3 p-3 ${config.bg} ${config.text} rounded-lg text-sm border ${config.border}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Container for system status display
 */
interface SystemStatusProps {
  /**
   * Array of status items to display
   */
  items: Array<{
    type: StatusType;
    message: string;
  }>;

  /**
   * Optional title (defaults to "System Status")
   */
  title?: string;
}

export function SystemStatus({ items, title = 'System Status' }: SystemStatusProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-900">{title}</h2>
      </div>
      <div className="p-6 space-y-4">
        {items.map((item, index) => (
          <StatusItem key={index} type={item.type} message={item.message} />
        ))}
      </div>
    </div>
  );
}
