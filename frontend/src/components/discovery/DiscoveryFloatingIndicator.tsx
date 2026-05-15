import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Maximize2, X, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { useDiscoveryContext } from '../../contexts/DiscoveryContext';

export function DiscoveryFloatingIndicator() {
  const { activeDiscovery, isMinimized, restoreDiscovery, clearDiscovery } = useDiscoveryContext();
  const [expanded, setExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeDiscovery || activeDiscovery.status !== 'discovering') return;
    const start = Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeDiscovery?.status]);

  if (!activeDiscovery || !isMinimized) return null;

  const isComplete = activeDiscovery.status === 'complete';
  const isFailed = activeDiscovery.status === 'failed';
  const isRunning = activeDiscovery.status === 'discovering';

  const recentUrls = activeDiscovery.discoveredUrls.slice(-5).reverse();

  const getPathFromUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname || '/';
    } catch {
      return url;
    }
  };

  let accentBg = 'var(--info-soft)';
  let accentEdge = 'var(--info-edge)';
  let accentFg = 'var(--info)';
  if (isComplete) {
    accentBg = 'var(--moss-soft)';
    accentEdge = 'var(--moss-edge)';
    accentFg = 'var(--moss)';
  } else if (isFailed) {
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
            {isFailed && <AlertCircle size={14} />}
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
              {isRunning && `Discovering: ${activeDiscovery.phase}${elapsedSeconds > 0 ? ` (${elapsedSeconds}s)` : ''}`}
              {isComplete && 'Discovery complete'}
              {isFailed && 'Discovery failed'}
            </span>
            <span className="dim tabular" style={{ fontSize: 11 }}>
              {activeDiscovery.pagesFound} / {activeDiscovery.maxPages} pages
            </span>
          </div>

          <div className="row" style={{ gap: 2, flexShrink: 0 }}>
            {isRunning && recentUrls.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="icon-btn"
                title={expanded ? 'Hide details' : 'Show recent pages'}
              >
                {expanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
              </button>
            )}
            <button
              type="button"
              onClick={restoreDiscovery}
              className="icon-btn"
              title="View full details"
            >
              <Maximize2 size={13} />
            </button>
            {(isComplete || isFailed) && (
              <button
                type="button"
                onClick={clearDiscovery}
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
                  width: `${activeDiscovery.maxPages > 0 ? Math.min(100, Math.round((activeDiscovery.pagesFound / activeDiscovery.maxPages) * 100)) : 0}%`,
                  background: accentFg,
                  transition: 'width .5s ease',
                }}
              />
            </div>
          </div>
        )}

        {expanded && isRunning && recentUrls.length > 0 && (
          <div
            style={{
              borderTop: `1px solid ${accentEdge}`,
              padding: '8px 16px',
              maxHeight: 160,
              overflowY: 'auto',
              background: 'var(--surface-2)',
            }}
          >
            <div className="dim" style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Recent pages found
            </div>
            <div className="col" style={{ gap: 3 }}>
              {recentUrls.map((url, idx) => (
                <div key={idx} className="row mono" style={{ gap: 6, fontSize: 11, color: 'var(--ink-2)' }}>
                  <Globe size={11} style={{ flexShrink: 0, color: accentFg }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={url}
                  >
                    {getPathFromUrl(url)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
