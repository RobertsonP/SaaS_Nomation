import { RotateCcw, X } from 'lucide-react';
import { usePageHelp } from '../../contexts/PageHelpContext';
import { pageHelp } from '../../help/pageHelp';

export function PageHelpDrawer() {
  const { activeKey, open, close, replayOnboarding } = usePageHelp();

  if (!activeKey) return null;
  const content = pageHelp[activeKey];
  if (!content) {
    // Unknown helpKey — silently render nothing rather than crash.
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--hair-2)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <div
              className="dim"
              style={{
                fontSize: 10.5,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {content.eyebrow}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              {content.title}
            </h3>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={close}
            aria-label="Close help"
          >
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 14, overflowY: 'auto', flex: 1 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
            }}
          >
            {content.intro}
          </p>

          {content.sections.map((section) => (
            <div key={section.heading} className="card card-pad">
              <div
                className="dim"
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}
              >
                Section
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ink)',
                  marginBottom: 6,
                }}
              >
                {section.heading}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: 'var(--ink-2)',
                }}
              >
                {section.body}
              </div>
              {section.tips && section.tips.length > 0 && (
                <ul
                  style={{
                    margin: '10px 0 0',
                    padding: '8px 12px 8px 24px',
                    borderLeft: '2px solid var(--moss)',
                    background: 'var(--moss-soft)',
                    borderRadius: 4,
                    listStyle: 'disc',
                    fontSize: 12,
                    color: 'var(--ink-2)',
                    lineHeight: 1.55,
                  }}
                >
                  {section.tips.map((tip, i) => (
                    <li key={i} style={{ marginBottom: i === section.tips!.length - 1 ? 0 : 4 }}>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {content.related && content.related.length > 0 && (
            <div className="card card-pad">
              <div
                className="dim"
                style={{
                  fontSize: 10.5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                Related
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {content.related.map((r) => (
                  <button
                    key={r.helpKey}
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => open(r.helpKey)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost btn-sm left"
            onClick={replayOnboarding}
            title="Clear the seen-flag and replay onboarding next time you land on the dashboard"
          >
            <RotateCcw size={12} />
            <span>Replay onboarding</span>
          </button>
          <button type="button" className="btn btn-outline" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
