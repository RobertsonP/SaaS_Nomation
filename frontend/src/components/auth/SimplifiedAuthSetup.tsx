import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Play, Shield, X, XCircle } from 'lucide-react';
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

export const SimplifiedAuthSetup: React.FC<SimplifiedAuthSetupProps> = ({
  projectId,
  onComplete,
  onCancel,
  authFlowId,
  initialData,
}) => {
  const isEditMode = Boolean(authFlowId && initialData);
  const [selectedTemplate, setSelectedTemplate] = useState<AuthTemplate | null>(null);
  const [name, setName] = useState(initialData?.name || 'Customer login');
  const [loginUrl, setLoginUrl] = useState(initialData?.loginUrl || '');
  const [username, setUsername] = useState(initialData?.username || '');
  const [password, setPassword] = useState(initialData?.password || '');
  const [method, setMethod] = useState<'form' | 'oauth' | 'api'>('form');
  const [cookiePersistence, setCookiePersistence] = useState<'session' | 'persistent'>('session');

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<
    | null
    | { success: boolean; message: string; suggestions?: string[] }
  >(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || 'Customer login');
      setLoginUrl(initialData.loginUrl || '');
      setUsername(initialData.username || '');
      setPassword(initialData.password || '');
    }
  }, [initialData]);

  useEffect(() => {
    let cancelled = false;
    authFlowsAPI
      .getTemplates()
      .then((response) => {
        if (cancelled) return;
        const templates: AuthTemplate[] = response.data || [];
        if (templates.length > 0) setSelectedTemplate(templates[0]);
      })
      .catch((err) => logger.warn('Failed to load auth templates', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const valid = loginUrl.trim() && username.trim() && password.trim();

  const handleTest = async () => {
    if (!valid || !selectedTemplate) {
      setTestResult({
        success: false,
        message: 'Fill in login URL, username, and password before testing.',
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const response = await authFlowsAPI.testAuth({
        loginUrl,
        username,
        password,
        steps: selectedTemplate.steps,
      });
      const result = response.data;
      setTestResult({
        success: !!result.success,
        message: result.message || (result.success ? 'Login succeeded.' : 'Login failed.'),
        suggestions: result.suggestions,
      });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      setTestResult({ success: false, message: `Test failed: ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    setTestResult(null);
    try {
      const payload = {
        name,
        loginUrl,
        username,
        password,
        steps: selectedTemplate?.steps || [],
        useAutoDetection: true,
        manualSelectors: null,
      };
      if (isEditMode && authFlowId) {
        await authFlowsAPI.update(authFlowId, payload);
      } else {
        await authFlowsAPI.create(projectId, payload);
      }
      setTestResult({
        success: true,
        message: isEditMode ? 'Auth flow updated.' : 'Auth flow saved.',
      });
      setTimeout(() => onComplete(), 600);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Unknown error';
      setTestResult({ success: false, message: `Save failed: ${msg}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEditMode ? 'Edit authentication flow' : 'Configure authentication'}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 14 }}>
          <div className="field">
            <label>Flow name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Customer login"
              autoFocus
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                Method <SoonPill />
              </label>
              <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="form">Form login</option>
                <option value="oauth" disabled>OAuth (soon)</option>
                <option value="api" disabled>API token (soon)</option>
              </select>
            </div>
            <div className="field">
              <label>
                Cookie persistence <SoonPill />
              </label>
              <select
                value={cookiePersistence}
                onChange={(e) => setCookiePersistence(e.target.value as any)}
                disabled
              >
                <option value="session">Session</option>
                <option value="persistent">Persistent</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Username (variable)</label>
              <input
                className="mono"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="${TEST_USER_EMAIL}"
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password (secret)</label>
              <input
                type="password"
                className="mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="${TEST_USER_PASSWORD}"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="field">
            <label>Login URL</label>
            <input
              className="mono"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://example.com/auth/login"
            />
          </div>

          <div
            className="row"
            style={{
              padding: 10,
              background: 'var(--surface-2)',
              borderRadius: 6,
              gap: 10,
            }}
          >
            <span style={{ color: 'var(--moss)', display: 'inline-flex', alignItems: 'center' }}>
              <Shield size={14} />
            </span>
            <span className="dim" style={{ fontSize: 12, flex: 1 }}>
              Secrets are encrypted at rest. Verify by running a test login.
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleTest}
              disabled={testing || !valid}
              style={testing || !valid ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
              {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              <span>{testing ? 'Testing…' : 'Test login'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className="row"
              style={{
                padding: 10,
                background: testResult.success ? 'var(--moss-soft)' : 'var(--clay-soft)',
                border: `1px solid ${
                  testResult.success ? 'var(--moss-edge)' : 'var(--clay-edge)'
                }`,
                borderRadius: 6,
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <span
                style={{
                  color: testResult.success ? 'var(--moss)' : 'var(--clay)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {testResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: testResult.success ? 'var(--moss)' : 'var(--clay)',
                  }}
                >
                  {testResult.message}
                </div>
                {testResult.suggestions && testResult.suggestions.length > 0 && (
                  <ul
                    style={{
                      margin: '4px 0 0',
                      paddingLeft: 18,
                      fontSize: 11.5,
                      color: testResult.success ? 'var(--moss)' : 'var(--clay)',
                      lineHeight: 1.55,
                    }}
                  >
                    {testResult.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!valid || saving}
            style={!valid || saving ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            <span>{saving ? 'Saving…' : isEditMode ? 'Update flow' : 'Save flow'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

function SoonPill() {
  return (
    <span
      style={{
        marginLeft: 6,
        padding: '0 6px',
        height: 14,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background: 'var(--amber-soft)',
        color: 'var(--amber)',
        border: '1px solid var(--amber-edge)',
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        verticalAlign: 'middle',
      }}
    >
      soon
    </span>
  );
}
