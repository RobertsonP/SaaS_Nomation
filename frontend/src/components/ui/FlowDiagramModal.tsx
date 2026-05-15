import { useEffect } from 'react';
import { X } from 'lucide-react';

const STEPS = [
  {
    n: 1,
    title: 'Add a Site',
    desc: 'You enter one or more URLs. Each URL becomes a Site under the project — Production, Staging, Preview, etc.',
  },
  {
    n: 2,
    title: 'Crawl & Discover',
    desc: 'Nomation walks each Site (respecting depth & exclusions), records every page it lands on, and builds the live Sitemap.',
  },
  {
    n: 3,
    title: 'Detect Elements',
    desc: 'On each discovered page, the engine extracts interactive elements: inputs, buttons, links, forms. It scores selector reliability and stores them in the Element library.',
  },
  {
    n: 4,
    title: 'Pick & Refine',
    desc: 'You open the Picker on any URL. Click anything → Nomation suggests stable selectors (data-testid > role > CSS) and adds the element to the library with a confidence score.',
  },
  {
    n: 5,
    title: 'Build Tests',
    desc: 'Drag picked elements into the Test Builder timeline. Compose actions (click, type, assert). Tests are bound to elements, so changes propagate.',
  },
  {
    n: 6,
    title: 'Group & Schedule',
    desc: 'Bundle related tests into Suites. Suites get cadence (every 30m, daily, on push) and notification rules.',
  },
  {
    n: 7,
    title: 'Run & Triage',
    desc: 'Suites execute on the browser pool. Failures land in the dashboard with screenshot, video, and selector trace. One click to re-pick the broken element.',
  },
];

const PIPELINE_NODES = [
  { x: 20, label: 'Site URLs' },
  { x: 160, label: 'Sitemap' },
  { x: 300, label: 'Elements' },
  { x: 440, label: 'Tests' },
  { x: 580, label: 'Suites & runs' },
];

interface FlowDiagramModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "How it works" pipeline diagram opened from the topbar.
 * Static educational content — explains the URL → Sitemap → Elements → Tests
 * pipeline with a 7-step breakdown.
 */
export function FlowDiagramModal({ open, onClose }: FlowDiagramModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">How Nomation works</div>
            <div className="modal-sub">URL → Sitemap → Elements → Tests</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <div className="flow-stage" style={{ marginBottom: 14 }}>
            <svg viewBox="0 0 720 90" width="100%" height="90" aria-hidden="true">
              <defs>
                <marker
                  id="flow-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--moss)" />
                </marker>
              </defs>
              {PIPELINE_NODES.map((node, i, arr) => (
                <g key={i}>
                  <rect
                    x={node.x}
                    y="20"
                    width="120"
                    height="50"
                    rx="8"
                    fill="var(--surface)"
                    stroke="var(--hair-2)"
                  />
                  <text
                    x={node.x + 60}
                    y="50"
                    fontFamily="Geist, sans-serif"
                    fontSize="12"
                    fontWeight="600"
                    fill="var(--ink)"
                    textAnchor="middle"
                  >
                    {node.label}
                  </text>
                  {i < arr.length - 1 && (
                    <path
                      d={`M${node.x + 124},45 L${arr[i + 1].x - 4},45`}
                      stroke="var(--moss)"
                      strokeWidth="1.5"
                      markerEnd="url(#flow-arrow)"
                    />
                  )}
                </g>
              ))}
            </svg>
          </div>

          {STEPS.map((step, i) => (
            <div key={step.n}>
              <div className="flow-step">
                <div className="flow-num">{step.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-3)',
                      marginTop: 2,
                      lineHeight: 1.5,
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
              </div>
              {i < STEPS.length - 1 && <div className="flow-arrow" />}
            </div>
          ))}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
