import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authAPI } from '../../lib/api';
import { timezonesByRegion } from '../../lib/timezones';
import { User, Lock, Globe, Moon, Sun, CreditCard, Zap, Users, Calendar } from 'lucide-react';

interface PlanInfo {
  plan: string;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  maxUsers: number;
  maxExecutions: number;
}

export function ProfileSettingsPage() {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const { theme, setTheme } = useTheme();

  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  // Fetch profile with plan info
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await authAPI.profile();
        const data = response.data;
        if (data.organization) {
          setPlanInfo({
            plan: data.organization.plan || 'free',
            subscriptionStatus: data.organization.subscriptionStatus || 'inactive',
            currentPeriodEnd: data.organization.currentPeriodEnd,
            cancelAtPeriodEnd: data.organization.cancelAtPeriodEnd || false,
            maxUsers: data.organization.maxUsers || 1,
            maxExecutions: data.organization.maxExecutions || 100,
          });
        }
        // Update profile data with fetched info
        if (data.timezone) {
          setProfileData(prev => ({ ...prev, timezone: data.timezone }));
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setPlanLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authAPI.updateProfile({
        name: profileData.name,
        timezone: profileData.timezone
      });
      showSuccess('Profile Updated', 'Your profile information has been updated.');
      // Ideally refresh user context here
    } catch (error: any) {
      showError('Update Failed', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate current password
    if (!passwordData.currentPassword) {
      showError('Validation Error', 'Current password is required');
      return;
    }

    // Validate new password
    if (!passwordData.newPassword) {
      showError('Validation Error', 'New password is required');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      showError('Validation Error', 'New password must be at least 8 characters long');
      return;
    }

    // Validate password match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Validation Error', 'New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      showSuccess('Password Changed', 'Your password has been updated successfully.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showError('Change Failed', error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Account Settings</h1>

      <div className="grid grid-cols-1 gap-8">
        {/* Profile Information */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <User className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Profile Information
            </h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Timezone</label>
                  <div className="relative">
                    <select
                      value={profileData.timezone}
                      onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {Object.entries(timezonesByRegion).map(([region, zones]) => (
                        <optgroup key={region} label={region}>
                          {zones.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              (UTC{tz.offset}) {tz.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500 absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Theme</label>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center px-3 py-2 border rounded-lg transition-colors ${
                        theme === 'light'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Sun className="w-4 h-4 mr-2" /> Light
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center px-3 py-2 border rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Moon className="w-4 h-4 mr-2" /> Dark
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Subscription Plan */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Your Plan
            </h2>
          </div>
          <div className="p-6">
            {planLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            ) : planInfo ? (
              <div className="space-y-6">
                {/* Plan Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        planInfo.plan === 'enterprise' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
                        planInfo.plan === 'pro' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {planInfo.plan.charAt(0).toUpperCase() + planInfo.plan.slice(1)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        planInfo.subscriptionStatus === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        planInfo.subscriptionStatus === 'trialing' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        planInfo.subscriptionStatus === 'past_due' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {planInfo.subscriptionStatus === 'active' ? 'Active' :
                         planInfo.subscriptionStatus === 'trialing' ? 'Trial' :
                         planInfo.subscriptionStatus === 'past_due' ? 'Past Due' :
                         planInfo.subscriptionStatus === 'canceled' ? 'Canceled' :
                         'Inactive'}
                      </span>
                    </div>
                    {planInfo.currentPeriodEnd && planInfo.subscriptionStatus === 'active' && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {planInfo.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {new Date(planInfo.currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Usage Limits */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Plan Limits</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                      <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-1">
                        <Zap className="w-4 h-4 mr-1" />
                        Test Executions
                      </div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {planInfo.maxExecutions === -1 ? 'Unlimited' : `${planInfo.maxExecutions}/month`}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                      <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-1">
                        <Users className="w-4 h-4 mr-1" />
                        Team Members
                      </div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-white">
                        {planInfo.maxUsers === -1 ? 'Unlimited' : planInfo.maxUsers}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upgrade Button for Free Plan */}
                {planInfo.plan === 'free' && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => {/* TODO: Implement upgrade flow */}}
                      className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Upgrade to Pro
                    </button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                      Get unlimited test executions and team collaboration
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Unable to load plan information.</p>
            )}
          </div>
        </section>

        {/* Password Change */}
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Lock className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
              Security
            </h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
