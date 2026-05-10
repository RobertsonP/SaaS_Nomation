import { Lock, Pencil, Play, Plus, Shield, Trash2 } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';

interface AuthFlow {
  id: string;
  name: string;
  loginUrl: string;
  steps?: Array<{ type: string; selector?: string; value?: string }>;
}

interface ProjectAuthTabProps {
  authFlows: AuthFlow[];
  onAddAuthentication: () => void;
  onEditAuthentication: (authFlow: AuthFlow) => void;
  onDeleteAuthentication: (authFlowId: string, authFlowName: string) => void;
}

export function ProjectAuthTab({
  authFlows,
  onAddAuthentication,
  onEditAuthentication,
  onDeleteAuthentication,
}: ProjectAuthTabProps) {
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
        <div>
          <div
            style={{
              fontFamily: 'Inter Tight',
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              color: 'var(--ink)',
            }}
          >
            Authentication flows
          </div>
          <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
            Configure login credentials for testing authenticated pages.
          </div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onAddAuthentication}>
          <Plus size={13} />
          <span>Add authentication</span>
        </button>
      </div>

      {authFlows.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">
              <Lock size={20} />
            </div>
            <h3>No authentication configured</h3>
            <p>Add an auth flow to test pages that require login credentials.</p>
            <button type="button" className="btn btn-primary" onClick={onAddAuthentication}>
              <Shield size={13} />
              <span>Setup authentication</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {authFlows.map((authFlow) => (
            <div key={authFlow.id} className="card">
              <div className="card-head">
                <div className="row" style={{ gap: 10 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: 'var(--moss-soft)',
                      color: 'var(--moss)',
                      border: '1px solid var(--moss-edge)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Shield size={14} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                      {authFlow.name}
                    </div>
                    <a
                      href={authFlow.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono dim"
                      style={{
                        fontSize: 11,
                        textDecoration: 'none',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 360,
                      }}
                      title={authFlow.loginUrl}
                    >
                      {authFlow.loginUrl}
                    </a>
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <Pill kind="ok" dot={false}>verified</Pill>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onEditAuthentication(authFlow)}
                  >
                    <Pencil size={12} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    title="Run a test login to verify the flow"
                  >
                    <Play size={12} />
                    <span>Test login</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    onClick={() => onDeleteAuthentication(authFlow.id, authFlow.name)}
                    style={{ color: 'var(--clay)' }}
                    title="Delete auth flow"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {authFlow.steps && authFlow.steps.length > 0 && (
                <div className="card-pad">
                  <div className="col" style={{ gap: 4 }}>
                    {authFlow.steps.map((step, j) => (
                      <div
                        key={j}
                        className="row"
                        style={{
                          padding: '4px 6px',
                          borderRadius: 4,
                          background: 'var(--surface-2)',
                          gap: 8,
                        }}
                      >
                        <span
                          className="mono"
                          style={{ width: 22, color: 'var(--ink-4)', fontSize: 10.5 }}
                        >
                          {j + 1}
                        </span>
                        <Pill kind="info" dot={false}>{step.type}</Pill>
                        {step.selector && (
                          <span
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: 'var(--ink-2)',
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={step.selector}
                          >
                            {step.selector}
                          </span>
                        )}
                        {step.value && (
                          <>
                            <span className="dim mono" style={{ fontSize: 10.5 }}>=</span>
                            <span
                              className="mono"
                              style={{ fontSize: 11, color: 'var(--moss)' }}
                            >
                              {step.value}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
