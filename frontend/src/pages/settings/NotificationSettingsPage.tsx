import { useState, useEffect } from 'react';
import { useNotification } from '../../contexts/NotificationContext';
import { authAPI } from '../../lib/api';
import { Bell, Clock, Mail, Check } from 'lucide-react';

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
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addEmail = () => {
    if (!newEmail.trim()) {
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showError('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Check for duplicates
    if (preferences.notificationEmails.includes(newEmail)) {
      showError('Duplicate Email', 'This email has already been added');
      return;
    }

    setPreferences(prev => ({
      ...prev,
      notificationEmails: [...prev.notificationEmails, newEmail]
    }));
    setNewEmail('');
  };

  const removeEmail = (email: string) => {
    setPreferences(prev => ({
      ...prev,
      notificationEmails: prev.notificationEmails.filter(e => e !== email)
    }));
  };

  if (isLoading) return <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Notification Settings</h1>

      <div className="space-y-8">
        {/* Email Alerts */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Bell className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Email Alerts
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Test Failure Alerts</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified immediately when a test fails.</p>
              </div>
              <button
                onClick={() => toggleSetting('emailFailures')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.emailFailures ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailFailures ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Test Success Notifications</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive confirmation when tests pass successfully.</p>
              </div>
              <button
                onClick={() => toggleSetting('emailSuccess')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.emailSuccess ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailSuccess ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Weekly Digest</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Summary of test performance sent every Monday.</p>
              </div>
              <button
                onClick={() => toggleSetting('emailWeeklyDigest')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  preferences.emailWeeklyDigest ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.emailWeeklyDigest ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </section>

        {/* Recipients */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Mail className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Recipients
            </h2>
          </div>
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <input
                type="email"
                placeholder="colleague@company.com"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <button
                onClick={addEmail}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Add
              </button>
            </div>

            <div className="space-y-2">
              {preferences.notificationEmails.map((email) => (
                <div key={email} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{email}</span>
                  <button
                    onClick={() => removeEmail(email)}
                    className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {preferences.notificationEmails.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No recipients added. Defaults to your account email.</p>
              )}
            </div>
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Clock className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Quiet Hours (UTC)
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Notifications will be paused during this time range.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={preferences.quietHoursStart || ''}
                  onChange={(e) => setPreferences({ ...preferences, quietHoursStart: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time</label>
                <input
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={preferences.quietHoursEnd || ''}
                  onChange={(e) => setPreferences({ ...preferences, quietHoursEnd: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center"
          >
            {isSaving ? 'Saving...' : (
              <>
                <Check className="w-4 h-4 mr-2" /> Save Settings
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
