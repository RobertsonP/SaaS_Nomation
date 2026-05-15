import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useNotification, Notification } from '../../contexts/NotificationContext';

const NotificationItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const { removeNotification } = useNotification();

  const toastClass =
    notification.type === 'error'
      ? 'toast toast-err'
      : notification.type === 'warning'
      ? 'toast toast-warn'
      : notification.type === 'info'
      ? 'toast toast-info'
      : 'toast';

  const icon =
    notification.type === 'error' ? (
      <AlertTriangle size={16} />
    ) : notification.type === 'warning' ? (
      <AlertTriangle size={16} />
    ) : notification.type === 'info' ? (
      <Info size={16} />
    ) : (
      <CheckCircle2 size={16} />
    );

  return (
    <div className={toastClass} role="status">
      <div className="toast-icon">{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="toast-title">{notification.title}</div>
        {notification.message && <div className="toast-msg">{notification.message}</div>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => removeNotification(notification.id)}
        aria-label="Dismiss notification"
      >
        <X size={12} />
      </button>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const { notifications } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
};
