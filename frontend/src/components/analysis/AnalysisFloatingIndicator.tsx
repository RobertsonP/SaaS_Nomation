import { Loader2, CheckCircle2, AlertCircle, Maximize2, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAnalysisContext } from '../../contexts/AnalysisContext';

export function AnalysisFloatingIndicator() {
  const { activeProjectId, projectName, isMinimized, progress, restoreAnalysis, clearAnalysis } = useAnalysisContext();
  const navigate = useNavigate();
  const location = useLocation();

  if (!activeProjectId || !isMinimized) return null;

  const onRestore = () => {
    restoreAnalysis();
    if (!location.pathname.startsWith(`/projects/${activeProjectId}`)) {
      navigate(`/projects/${activeProjectId}`);
    }
  };
  const onDismiss = clearAnalysis;

  const { isComplete, hasError, currentPhaseLabel, overallPercent, currentUrlIndex, totalUrls, elementsFound } = progress;
  const isRunning = !isComplete && !hasError;

  let accentBg = 'var(--info-soft)';
  let accentEdge = 'var(--info-edge)';
  let accentFg = 'var(--info)';
  if (isComplete) {
    accentBg = 'var(--moss-soft)';
    accentEdge = 'var(--moss-edge)';
    accentFg = 'var(--moss)';
  } else if (hasError) {
    accentBg = 'var(--clay-soft)';
    accentEdge = 'var(--clay-edge)';
    accentFg = 'var(--clay)';
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 50,
        maxWidth: 360,
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: `1px solid ${accentEdge}`,
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-2)',
          position: 'relative',
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: accentFg,
          }}
        />

        <div className="row" style={{ alignItems: 'center', gap: 10, padding: '10px 14px 10px 16px' }}>
          <span
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              borderRadius: 6,
              background: accentBg,
              border: `1px solid ${accentEdge}`,
              color: accentFg,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {isRunning && <Loader2 size={14} className="animate-spin" />}
            {isComplete && <CheckCircle2 size={14} />}
            {hasError && <AlertCircle size={14} />}
          </span>

          <div className="col" style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isRunning && `Scanning: ${projectName}`}
              {isComplete && 'Analysis complete'}
              {hasError && 'Analysis failed'}
            </span>
            <span className="dim" style={{ fontSize: 11 }}>
              {isRunning && (
                <>
                  {totalUrls > 0 ? `Page ${Math.min(currentUrlIndex, totalUrls)}/${totalUrls}` : currentPhaseLabel}
                  {elementsFound > 0 && ` · ${elementsFound} elements`}
                </>
              )}
              {isComplete && 'Click to view results'}
              {hasError && 'Click to view details'}
            </span>
          </div>

          <div className="row" style={{ gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onRestore}
              className="icon-btn"
              title="View full details"
            >
              <Maximize2 size={13} />
            </button>
            {(isComplete || hasError) && (
              <button
                type="button"
                onClick={onDismiss}
                className="icon-btn"
                title="Dismiss"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {isRunning && (
          <div style={{ padding: '0 16px 10px' }}>
            <div
              style={{
                height: 4,
                background: 'var(--surface-2)',
                borderRadius: 999,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${overallPercent}%`,
                  background: accentFg,
                  transition: 'width .3s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
