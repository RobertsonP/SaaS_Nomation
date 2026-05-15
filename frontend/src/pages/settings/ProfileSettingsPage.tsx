import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import { authAPI } from '../../lib/api';
import { timezonesByRegion } from '../../lib/timezones';
import { PageHelpButton } from '../../components/help/PageHelpButton';
import {
  Calendar,
  CreditCard,
  Globe,
  Lock,
  Loader2,
  Moon,
  Sun,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { Pill, PillKind } from '../../components/ui/Pill';

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
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

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
        if (data.timezone) {
          setProfileData((prev) => ({ ...prev, timezone: data.timezone }));
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
        timezone: profileData.timezone,
      });
      showSuccess('Profile Updated', 'Your profile information has been updated.');
    } catch (error: any) {
      showError('Update Failed', error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordData.currentPassword) {
      showError('Validation Error', 'Current password is required');
      return;
    }
    if (!passwordData.newPassword) {
      showError('Validation Error', 'New password is required');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      showError('Validation Error', 'New password must be at least 8 characters long');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('Validation Error', 'New passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showSuccess('Password Changed', 'Your password has been updated successfully.');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      showError('Change Failed', error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const planKind: PillKind =
    planInfo?.plan === 'enterprise' ? 'info' : planInfo?.plan === 'pro' ? 'ok' : 'mute';
  const subscriptionKind: PillKind =
    planInfo?.subscriptionStatus === 'active'
      ? 'ok'
      : planInfo?.subscriptionStatus === 'trialing'
      ? 'warn'
      : planInfo?.subscriptionStatus === 'past_due'
      ? 'err'
      : 'mute';

  return (
    <div className="content" style={{ maxWidth: 920 }}>
      <div className="page-head">
        <div>
          <h1>Account Settings</h1>
          <div className="sub">Profile, plan, and security for your Nomation account.</div>
        </div>
        <div className="row">
          <PageHelpButton helpKey="profile-settings" />
        </div>
      </div>

      <div className="col" style={{ gap: 12 }}>
        {/* Profile Information */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <User size={14} className="dim" />
              <span>Profile Information</span>
            </span>
          </div>
          <form onSubmit={handleUpdateProfile} className="card-pad col" style={{ gap: 12 }}>
            <div className="field-row">
              <div className="field">
                <label htmlFor="profile-name">Full Name</label>
                <input
                  id="profile-name"
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-email">Email Address</label>
                <input
                  id="profile-email"
                  type="email"
                  value={profileData.email}
                  disabled
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
                />
                <span className="hint">Email cannot be changed yet.</span>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="profile-tz">Timezone</label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="profile-tz"
                    value={profileData.timezone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, timezone: e.target.value })
                    }
                    style={{ paddingRight: 28, width: '100%' }}
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
                  <Globe
                    size={13}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: 'var(--ink-4)',
                    }}
                  />
                </div>
              </div>

              <div className="field">
                <label>Theme</label>
                <div className="row" style={{ gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={theme === 'light' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Sun size={13} />
                    <span>Light</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={theme === 'dark' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Moon size={13} />
                    <span>Dark</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="row" style={{ justifyContent: 'flex-end', paddingTop: 4 }}>
              <button type="submit" disabled={isLoading} className="btn btn-primary">
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Subscription Plan */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <CreditCard size={14} className="dim" />
              <span>Your Plan</span>
            </span>
          </div>
          <div className="card-pad">
            {planLoading ? (
              <div className="col" style={{ gap: 8 }}>
                <div className="skel" style={{ height: 14, width: '40%' }} />
                <div className="skel" style={{ height: 14, width: '60%' }} />
              </div>
            ) : planInfo ? (
              <div className="col" style={{ gap: 14 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Pill kind={planKind}>
                    {planInfo.plan.charAt(0).toUpperCase() + planInfo.plan.slice(1)}
                  </Pill>
                  <Pill kind={subscriptionKind}>
                    {planInfo.subscriptionStatus === 'active'
                      ? 'Active'
                      : planInfo.subscriptionStatus === 'trialing'
                      ? 'Trial'
                      : planInfo.subscriptionStatus === 'past_due'
                      ? 'Past Due'
                      : planInfo.subscriptionStatus === 'canceled'
                      ? 'Canceled'
                      : 'Inactive'}
                  </Pill>
                  {planInfo.currentPeriodEnd && planInfo.subscriptionStatus === 'active' && (
                    <span
                      className="dim row"
                      style={{ fontSize: 11.5, gap: 4, alignItems: 'center' }}
                    >
                      <Calendar size={12} />
                      {planInfo.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on{' '}
                      {new Date(planInfo.currentPeriodEnd).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: 10,
                    borderTop: '1px solid var(--hair)',
                  }}
                >
                  <div
                    className="dim"
                    style={{
                      fontSize: 10.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      marginBottom: 8,
                    }}
                  >
                    Plan limits
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--hair)',
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}
                    >
                      <div className="row dim" style={{ fontSize: 11, gap: 4, marginBottom: 4 }}>
                        <Zap size={11} />
                        <span>Test Executions</span>
                      </div>
                      <div
                        className="tabular"
                        style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}
                      >
                        {planInfo.maxExecutions === -1
                          ? 'Unlimited'
                          : `${planInfo.maxExecutions}/month`}
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--hair)',
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}
                    >
                      <div className="row dim" style={{ fontSize: 11, gap: 4, marginBottom: 4 }}>
                        <Users size={11} />
                        <span>Team Members</span>
                      </div>
                      <div
                        className="tabular"
                        style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}
                      >
                        {planInfo.maxUsers === -1 ? 'Unlimited' : planInfo.maxUsers}
                      </div>
                    </div>
                  </div>
                </div>

                {planInfo.plan === 'free' && (
                  <div
                    style={{
                      paddingTop: 10,
                      borderTop: '1px solid var(--hair)',
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--moss-soft)',
                        border: '1px solid var(--moss-edge)',
                        borderRadius: 6,
                        padding: '10px 12px',
                        fontSize: 12,
                        color: 'var(--moss)',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>Pro Plan Coming Soon</div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        Contact support for early access.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="dim" style={{ margin: 0 }}>
                Unable to load plan information.
              </p>
            )}
          </div>
        </section>

        {/* Password Change */}
        <section className="card">
          <div className="card-head">
            <span className="card-title row" style={{ gap: 6 }}>
              <Lock size={14} className="dim" />
              <span>Security</span>
            </span>
          </div>
          <form
            onSubmit={handleChangePassword}
            className="card-pad col"
            style={{ gap: 12, maxWidth: 480 }}
          >
            <div className="field">
              <label htmlFor="cur-pw">Current Password</label>
              <input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                value={passwordData.currentPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, currentPassword: e.target.value })
                }
              />
            </div>
            <div className="field">
              <label htmlFor="new-pw">New Password</label>
              <input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={passwordData.newPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, newPassword: e.target.value })
                }
              />
              <span className="hint">Minimum 8 characters.</span>
            </div>
            <div className="field">
              <label htmlFor="conf-pw">Confirm New Password</label>
              <input
                id="conf-pw"
                type="password"
                autoComplete="new-password"
                value={passwordData.confirmPassword}
                onChange={(e) =>
                  setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                }
              />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" disabled={isLoading} className="btn btn-primary">
                {isLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Updating…</span>
                  </>
                ) : (
                  <span>Update Password</span>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
