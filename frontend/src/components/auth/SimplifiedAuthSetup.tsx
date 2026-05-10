import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Save,
  Shield,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';
import { authFlowsAPI } from '../../lib/api';
import { createLogger } from '../../lib/logger';

const logger = createLogger('AuthSetup');

interface AuthTemplate {
  name: string;
  description: string;
  domains: string[];
  steps: Array<{
    type: 'type' | 'click' | 'wait';
    selector: string;
    value?: string;
    description: string;
    timeout?: number;
    optional?: boolean;
  }>;
  successIndicators: string[];
  commonIssues: string[];
}

interface SimplifiedAuthSetupProps {
  projectId: string;
  onComplete: () => void;
  onCancel: () => void;
  authFlowId?: string;
  initialData?: {
    name: string;
    loginUrl: string;
    username: string;
    password: string;
    steps?: any[];
    useAutoDetection?: boolean;
    manualSelectors?: { usernameSelector: string; passwordSelector: string; submitSelector: string } | null;
  };
}

type Step = 'credentials' | 'test' | 'review';

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'credentials', label: 'Credentials' },
  { id: 'test', label: 'Test' },
  { id: 'review', label: 'Review' },
];

export const SimplifiedAuthSetup: React.FC<SimplifiedAuthSetupProps> = ({
  projectId,
  onComplete,
  onCancel,
  authFlowId,
  initialData,
}) => {
  const [step, setStep] = useState<Step>('credentials');
  const [, setTemplates] = useState<AuthTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AuthTemplate | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isEditMode = Boolean(authFlowId && initialData);

  const [credentials, setCredentials] = useState({
    name: initialData?.name || 'Main Authentication',
    loginUrl: initialData?.loginUrl || '',
    username: initialData?.username || '',
    password: initialData?.password || '',
  });

  useEffect(() => {
    if (initialData) {
      setCredentials({
        name: initialData.name || 'Main Authentication',
        loginUrl: initialData.loginUrl || '',
        username: initialData.username || '',
        password: initialData.password || '',
      });
    }
  }, [initialData]);

  const [useAutoDetection, setUseAutoDetection] = useState(
    initialData?.useAutoDetection !== undefined ? initialData.useAutoDetection : true,
  );
  const [manualSelectors, setManualSelectors] = useState({
    usernameSelector: initialData?.manualSelectors?.usernameSelector || '',
    passwordSelector: initialData?.manualSelectors?.passwordSelector || '',
    submitSelector: initialData?.manualSelectors?.submitSelector || '',
  });

  useEffect(() => {
    if (initialData) {
      setUseAutoDetection(initialData.useAutoDetection !== undefined ? initialData.useAutoDetection : true);
      if (initialData.manualSelectors) {
        setManualSelectors({
          usernameSelector: initialData.manualSelectors.usernameSelector || '',
          passwordSelector: initialData.manualSelectors.passwordSelector || '',
          submitSelector: initialData.manualSelectors.submitSelector || '',
        });
      }
    }
  }, [initialData]);

  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await authFlowsAPI.getTemplates();
      const templates = response.data;
      setTemplates(templates);
      if (templates.length > 0) {
        setSelectedTemplate(templates[0]);
      }
    } catch (error: any) {
      logger.error('Failed to load templates', error);
      setTestResult({
        success: false,
        message: 'Failed to load authentication templates',
        suggestions: [
          'Check your internet connection',
          'Verify you are logged in',
          'Try refreshing the page',
        ],
      });
    }
  };

  const handleTestAuthentication = async () => {
    if (!selectedTemplate || !credentials.loginUrl || !credentials.username || !credentials.password) {
      setTestResult({
        success: false,
        message: 'Please fill in all required fields',
        suggestions: [
          'Enter the login URL (e.g., https://tts.am/login)',
          'Enter your username',
          'Enter your password',
          'Select an authentication template',
        ],
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await authFlowsAPI.testAuth({
        loginUrl: credentials.loginUrl,
        username: credentials.username,
        password: credentials.password,
        steps: selectedTemplate.steps,
      });

      const result = response.data;
      setTestResult(result);
      if (result.success) {
        setStep('review');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setTestResult({
        success: false,
        message: `Authentication test failed: ${errorMessage}`,
        suggestions: [
          'Check your internet connection',
          'Verify the login URL is correct',
          'Check if the username and password are correct',
          'Try testing manually on the website first',
        ],
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveAuthFlow = async () => {
    if (!selectedTemplate) return;

    setSaving(true);
    setTestResult(null);

    try {
      const authFlowData = {
        name: credentials.name,
        loginUrl: credentials.loginUrl,
        username: credentials.username,
        password: credentials.password,
        steps: selectedTemplate.steps,
        useAutoDetection,
        manualSelectors: !useAutoDetection ? manualSelectors : null,
      };

      if (isEditMode && authFlowId) {
        await authFlowsAPI.update(authFlowId, authFlowData);
      } else {
        await authFlowsAPI.create(projectId, authFlowData);
      }

      setTestResult({
        success: true,
        message: isEditMode
          ? 'Authentication flow updated successfully'
          : 'Authentication flow created successfully',
        suggestions: [],
      });

      setTimeout(() => onComplete(), 800);
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      setTestResult({
        success: false,
        message: `Failed to ${isEditMode ? 'update' : 'save'} authentication flow: ${errorMessage}`,
        suggestions: [
          'Check your internet connection',
          'Verify all required fields are filled',
          'Try again in a few moments',
        ],
      });
    } finally {
      setSaving(false);
    }
  };

  const credentialsValid =
    credentials.loginUrl.trim() && credentials.username.trim() && credentials.password.trim();

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="modal-head">
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: 'var(--moss-soft)',
                color: 'var(--moss)',
                border: '1px solid var(--moss-edge)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Shield size={16} />
            </span>
            <div>
              <div className="modal-title">
                {isEditMode ? 'Edit authentication flow' : 'Set up authentication'}
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Configure a login flow so Nomation can test pages behind authentication.
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        {/* Stepper */}
        <div
          className="row"
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--hair)',
            background: 'var(--surface-2)',
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {STEPS.map((s, idx) => {
            const stepIdx = STEPS.findIndex((x) => x.id === step);
            const isCurrent = step === s.id;
            const isDone = stepIdx > idx;
            return (
              <React.Fragment key={s.id}>
                <div className="row" style={{ alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      background: isCurrent
                        ? 'var(--moss)'
                        : isDone
                        ? 'var(--moss-soft)'
                        : 'var(--surface)',
                      color: isCurrent ? '#fff' : isDone ? 'var(--moss)' : 'var(--ink-3)',
                      border: `1px solid ${
                        isCurrent || isDone ? 'var(--moss-edge)' : 'var(--hair)'
                      }`,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 10.5,
                      fontWeight: 600,
                    }}
                  >
                    {isDone ? <CheckCircle2 size={11} /> : idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isCurrent ? 600 : 500,
                      color: isCurrent ? 'var(--ink)' : 'var(--ink-3)',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <span
                    style={{
                      width: 24,
                      height: 1,
                      background: 'var(--hair)',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="modal-body col" style={{ gap: 16, overflowY: 'auto' }}>
          {step === 'credentials' && (
            <>
              <div
                style={{
                  background: 'var(--moss-soft)',
                  border: '1px solid var(--moss-edge)',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <Sparkles size={14} style={{ color: 'var(--moss)', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                      How it works
                    </div>
                    <ul
                      className="dim"
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        fontSize: 11.5,
                        lineHeight: 1.7,
                      }}
                    >
                      <li>Auto-detects username, password, and submit fields</li>
                      <li>Tests credentials safely before saving</li>
                      <li>Detailed feedback if something doesn't work</li>
                      <li>Falls back to manual CSS selectors if needed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Authentication flow name
                </label>
                <input
                  type="text"
                  className="field"
                  value={credentials.name}
                  onChange={(e) => setCredentials({ ...credentials, name: e.target.value })}
                  placeholder="e.g., Admin login, Customer portal"
                />
              </div>

              <div className="col" style={{ gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                  Login page URL <span style={{ color: 'var(--clay)' }}>*</span>
                </label>
                <input
                  type="url"
                  className="field mono"
                  value={credentials.loginUrl}
                  onChange={(e) => setCredentials({ ...credentials, loginUrl: e.target.value })}
                  placeholder="https://yoursite.com/login"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                <div className="col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                    Username / email <span style={{ color: 'var(--clay)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="field"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    placeholder="your.username@example.com"
                    autoComplete="username"
                  />
                </div>

                <div className="col" style={{ gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                    Password <span style={{ color: 'var(--clay)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="field"
                      value={credentials.password}
                      onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                      placeholder="Your secure password"
                      autoComplete="current-password"
                      style={{ paddingRight: 32 }}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 24,
                        height: 24,
                      }}
                    >
                      {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Auto-detection toggle */}
              <div
                style={{
                  background: useAutoDetection ? 'var(--moss-soft)' : 'var(--surface-2)',
                  border: `1px solid ${useAutoDetection ? 'var(--moss-edge)' : 'var(--hair)'}`,
                  borderRadius: 8,
                  padding: 12,
                  transition: 'background .15s ease, border-color .15s ease',
                }}
              >
                <label
                  className="row"
                  style={{
                    alignItems: 'flex-start',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useAutoDetection}
                    onChange={(e) => setUseAutoDetection(e.target.checked)}
                    style={{ marginTop: 2, accentColor: 'var(--moss)', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                      Use automatic field detection (recommended)
                    </div>
                    <p
                      className="dim"
                      style={{ margin: '4px 0 0', fontSize: 11.5, lineHeight: 1.55 }}
                    >
                      Smart detection finds username, password, and submit fields using 30+ strategies.
                      Works with React/Vue/Angular and most custom implementations.
                    </p>
                    {!useAutoDetection && (
                      <div
                        className="row"
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: 'var(--amber-soft)',
                          border: '1px solid var(--amber-edge)',
                          borderRadius: 4,
                          fontSize: 11.5,
                          color: 'var(--amber)',
                          gap: 6,
                          alignItems: 'flex-start',
                        }}
                      >
                        <AlertTriangle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
                        <span>
                          Manual mode requires exact CSS selectors. Only use if automatic detection
                          fails.
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {!useAutoDetection && (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                    Manual field selectors
                  </div>
                  <p className="dim" style={{ margin: '0 0 12px', fontSize: 11.5 }}>
                    Provide exact CSS selectors for each field.
                  </p>

                  <div className="col" style={{ gap: 12 }}>
                    <div className="col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                        Username / email selector <span style={{ color: 'var(--clay)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="field mono"
                        value={manualSelectors.usernameSelector}
                        onChange={(e) =>
                          setManualSelectors({ ...manualSelectors, usernameSelector: e.target.value })
                        }
                        placeholder='input[name="email"], #username'
                      />
                    </div>
                    <div className="col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                        Password selector <span style={{ color: 'var(--clay)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="field mono"
                        value={manualSelectors.passwordSelector}
                        onChange={(e) =>
                          setManualSelectors({ ...manualSelectors, passwordSelector: e.target.value })
                        }
                        placeholder='input[type="password"], #pass'
                      />
                    </div>
                    <div className="col" style={{ gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>
                        Submit button selector <span style={{ color: 'var(--clay)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="field mono"
                        value={manualSelectors.submitSelector}
                        onChange={(e) =>
                          setManualSelectors({ ...manualSelectors, submitSelector: e.target.value })
                        }
                        placeholder='button[type="submit"], #loginBtn'
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate && (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--hair)',
                    borderRadius: 8,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                    Selected template: {selectedTemplate.name}
                  </div>
                  <p className="dim" style={{ margin: '4px 0 8px', fontSize: 11.5 }}>
                    {selectedTemplate.description}
                  </p>
                  <div className="dim" style={{ fontSize: 11 }}>
                    <strong style={{ color: 'var(--ink-2)' }}>Steps:</strong>{' '}
                    {selectedTemplate.steps.map((s) => s.description).join(' → ')}
                  </div>
                </div>
              )}

              {testResult && testResult.success && (
                <div
                  style={{
                    background: 'var(--moss-soft)',
                    border: '1px solid var(--moss-edge)',
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  <div className="row" style={{ gap: 6, alignItems: 'center', color: 'var(--moss)' }}>
                    <CheckCircle2 size={13} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{testResult.message}</span>
                  </div>
                </div>
              )}
              {testResult && !testResult.success && (
                <div
                  style={{
                    background: 'var(--clay-soft)',
                    border: '1px solid var(--clay-edge)',
                    borderRadius: 6,
                    padding: 10,
                  }}
                >
                  <div className="row" style={{ gap: 6, alignItems: 'flex-start', color: 'var(--clay)' }}>
                    <XCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{testResult.message}</div>
                      {testResult.suggestions && testResult.suggestions.length > 0 && (
                        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11.5, lineHeight: 1.55 }}>
                          {testResult.suggestions.map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'test' && (
            <div className="col" style={{ gap: 16, alignItems: 'center', textAlign: 'center', padding: 12 }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'var(--info-soft)',
                  border: '1px solid var(--info-edge)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--info)',
                }}
              >
                {testing ? <Loader2 size={24} className="animate-spin" /> : <Lock size={24} />}
              </span>
              <div>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                  {testing ? 'Testing authentication…' : 'Test authentication flow'}
                </div>
                <p className="dim" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  We'll log in with your credentials and report any issues before saving.
                </p>
              </div>

              {!testResult && !testing && (
                <button type="button" onClick={handleTestAuthentication} className="btn btn-primary">
                  <Lock size={13} />
                  <span>Start authentication test</span>
                </button>
              )}

              {testResult && (
                <div
                  style={{
                    width: '100%',
                    padding: 14,
                    borderRadius: 8,
                    background: testResult.success ? 'var(--moss-soft)' : 'var(--clay-soft)',
                    border: `1px solid ${testResult.success ? 'var(--moss-edge)' : 'var(--clay-edge)'}`,
                    textAlign: 'left',
                  }}
                >
                  <div
                    className="row"
                    style={{
                      gap: 8,
                      alignItems: 'flex-start',
                      color: testResult.success ? 'var(--moss)' : 'var(--clay)',
                    }}
                  >
                    {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Inter Tight', fontSize: 14, fontWeight: 600 }}>
                        {testResult.success ? 'Authentication successful' : 'Authentication failed'}
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                        {testResult.message}
                      </p>
                      {testResult.details && (
                        <div className="dim tabular" style={{ marginTop: 8, fontSize: 11.5 }}>
                          Steps completed: {testResult.details.stepsCompleted}/{testResult.details.totalSteps}
                          {testResult.details.finalUrl && (
                            <>
                              {' · Final URL: '}
                              <code className="mono">{testResult.details.finalUrl}</code>
                            </>
                          )}
                        </div>
                      )}
                      {testResult.suggestions && testResult.suggestions.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                            Suggestions
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, lineHeight: 1.55 }}>
                            {testResult.suggestions.map((s: string, i: number) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'review' && testResult?.success && (
            <div className="col" style={{ gap: 16, alignItems: 'center', textAlign: 'center', padding: 12 }}>
              <span
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'var(--moss-soft)',
                  border: '1px solid var(--moss-edge)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--moss)',
                }}
              >
                <CheckCircle2 size={28} />
              </span>
              <div>
                <div style={{ fontFamily: 'Inter Tight', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                  Authentication ready
                </div>
                <p className="dim" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
                  Your authentication flow has been tested and is ready to use.
                </p>
              </div>

              <div
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--hair)',
                  borderRadius: 8,
                  padding: 14,
                  textAlign: 'left',
                }}
              >
                <div className="col" style={{ gap: 8 }}>
                  <ReviewRow label="Flow name" value={credentials.name} />
                  <ReviewRow label="Login URL" value={credentials.loginUrl} mono />
                  <ReviewRow label="Template" value={selectedTemplate?.name || '—'} />
                  <ReviewRow label="Status" value="Verified" tone="moss" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="row" style={{ gap: 6 }}>
            {step === 'test' && (
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="btn btn-ghost"
              >
                <ArrowLeft size={13} />
                <span>Back</span>
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                onClick={() => setStep('test')}
                className="btn btn-ghost"
              >
                <ArrowLeft size={13} />
                <span>Test again</span>
              </button>
            )}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" onClick={onCancel} className="btn btn-ghost">
              Cancel
            </button>
            {step === 'credentials' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('test')}
                  disabled={!credentialsValid}
                  className="btn btn-outline"
                  style={!credentialsValid ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  <Lock size={13} />
                  <span>Test first</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveAuthFlow}
                  disabled={!credentialsValid || saving}
                  className="btn btn-success"
                  style={!credentialsValid || saving ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>{saving ? 'Saving…' : isEditMode ? 'Update auth flow' : 'Save auth flow'}</span>
                </button>
              </>
            )}
            {step === 'test' && testResult?.success && (
              <button
                type="button"
                onClick={() => setStep('review')}
                className="btn btn-primary"
              >
                Continue to review
              </button>
            )}
            {step === 'test' && testResult && !testResult.success && (
              <button
                type="button"
                onClick={handleTestAuthentication}
                disabled={testing}
                className="btn btn-primary"
                style={testing ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {testing ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                <span>{testing ? 'Testing…' : 'Try again'}</span>
              </button>
            )}
            {step === 'review' && (
              <button
                type="button"
                onClick={handleSaveAuthFlow}
                disabled={saving}
                className="btn btn-success"
                style={saving ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                <span>
                  {saving
                    ? isEditMode
                      ? 'Updating…'
                      : 'Saving…'
                    : isEditMode
                    ? 'Update authentication'
                    : 'Save authentication'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function ReviewRow({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: 'moss' | 'clay';
}) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', flexShrink: 0 }}>{label}</span>
      <span
        className={mono ? 'mono' : undefined}
        style={{
          fontSize: 11.5,
          color: tone === 'moss' ? 'var(--moss)' : 'var(--ink-2)',
          fontWeight: tone ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'right',
        }}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
