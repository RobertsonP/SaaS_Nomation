import { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { authAPI } from '../../lib/api';
import { Bell, Check, Clock, Loader2, Mail, Plus, Trash2 } from 'lucide-react';

export function NotificationSettingsPage() {
  const { showSuccess, showError } = useNotification();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    emailFailures: true,
    emailSuccess: false,
    emailWeeklyDigest: true,
    notificationEmails: [] as string[],
    quietHoursStart: '',
    quietHoursEnd: '',
  });
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await authAPI.getNotificationPreferences();
      setPreferences(response.data);
    } catch (error) {
      console.error('Failed to load preferences:', error);
      showError('Load Error', 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authAPI.updateNotificationPreferences(preferences);
      showSuccess('Saved', 'Notification preferences updated');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      showError('Save Error', 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSetting = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const addEmail = () => {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      return;
    }
    if (preferences.notificationEmails.includes(newEmail)) {
      showError('Duplicate Email', 'This email has already been added');
      return;
    }
    setPreferences((prev) => ({
      ...prev,
      notificationEmails: [...prev.notificationEmails, newEmail],
    }));
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setPreferences((prev) => ({
      ...prev,
      notificationEmails: prev.notificationEmails.filter((e) => e !== email),
    }));
  };

  if (isLoading) {
    return (
      <div className="content">
        <div className="row" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  const ToggleRow = ({
    title,
    desc,
    on,
    onChange,
  }: {
    title: string;
    desc: string;
    on: boolean;
    onChange: () => void;
  }) => (
    <div
      className="row"
      style={{
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        padding: '8px 0',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`switch ${on ? 'on' : ''}`}
        aria-pressed={on}
        aria-label={title}
      />
    </div>
  );

  return (
    <div className="content" style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <h1>Notification Settings</h1>
          <div className="sub">Choose what you want to hear about and when.</div>
        </div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        {/* Email Alerts */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <Bell size={14} className="dim" />
              <span>Email Alerts</span>
            </span>
          </div>
          <div className="card-pad col" style={{ gap: 0 }}>
            <ToggleRow
              title="Test Failure Alerts"
              desc="Get notified immediately when a test fails."
              on={preferences.emailFailures}
              onChange={() => toggleSetting('emailFailures')}
            />
            <div style={{ borderTop: '1px solid var(--hair)' }} />
            <ToggleRow
              title="Test Success Notifications"
              desc="Receive confirmation when tests pass successfully."
              on={preferences.emailSuccess}
              onChange={() => toggleSetting('emailSuccess')}
            />
            <div style={{ borderTop: '1px solid var(--hair)' }} />
            <ToggleRow
              title="Weekly Digest"
              desc="Summary of test performance sent every Monday."
              on={preferences.emailWeeklyDigest}
              onChange={() => toggleSetting('emailWeeklyDigest')}
            />
          </div>
        </section>

        {/* Recipients */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <Mail size={14} className="dim" />
              <span>Recipients</span>
            </span>
          </div>
          <div className="card-pad col" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 6 }}>
              <input
                type="email"
                placeholder="colleague@company.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
                style={{
                  flex: 1,
                  background: 'var(--surface)',
                  border: '1px solid var(--hair-2)',
                  borderRadius: 5,
                  padding: '6px 8px',
                  fontSize: 12.5,
                  color: 'var(--ink)',
                }}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={addEmail}>
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>

            <div className="col" style={{ gap: 4 }}>
              {preferences.notificationEmails.map((email) => (
                <div
                  key={email}
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 5,
                  }}
                >
                  <span className="mono" style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    {email}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeEmail(email)}
                    style={{ color: 'var(--clay)' }}
                    title="Remove recipient"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {preferences.notificationEmails.length === 0 && (
                <span className="dim" style={{ fontSize: 12, fontStyle: 'italic' }}>
                  No recipients added. Defaults to your account email.
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <Clock size={14} className="dim" />
              <span>Quiet Hours (UTC)</span>
            </span>
          </div>
          <div className="card-pad col" style={{ gap: 10 }}>
            <span className="dim" style={{ fontSize: 11.5 }}>
              Notifications will be paused during this time range.
            </span>
            <div className="field-row">
              <div className="field">
                <label htmlFor="qh-start">Start Time</label>
                <input
                  id="qh-start"
                  type="time"
                  value={preferences.quietHoursStart || ''}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursStart: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="qh-end">End Time</label>
                <input
                  id="qh-end"
                  type="time"
                  value={preferences.quietHoursEnd || ''}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary"
          >
            {isSaving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Check size={13} />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
