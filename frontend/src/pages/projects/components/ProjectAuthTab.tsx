import { Lock, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { Pill } from '../../../components/ui/Pill';

interface AuthFlow {
  id: string;
  name: string;
  loginUrl: string;
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
        <div className="col" style={{ gap: 6 }}>
          {authFlows.map((authFlow) => (
            <div
              key={authFlow.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                borderRadius: 6,
                padding: '10px 12px',
              }}
            >
              <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {authFlow.name}
                    </span>
                    <Pill kind="ok">Active</Pill>
                  </div>
                  <a
                    href={authFlow.loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--slate)',
                      textDecoration: 'none',
                      display: 'block',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={authFlow.loginUrl}
                  >
                    {authFlow.loginUrl}
                  </a>
                </div>
                <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onEditAuthentication(authFlow)}
                    className="btn btn-ghost btn-sm"
                  >
                    <Pencil size={13} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteAuthentication(authFlow.id, authFlow.name)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--clay)' }}
                    title="Delete auth flow"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
