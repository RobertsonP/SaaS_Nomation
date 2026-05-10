import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';

interface RunModePickerModalProps {
  open: boolean;
  testName: string;
  onCancel: () => void;
  onPick: (mode: 'headed' | 'headless') => void;
}

export function RunModePickerModal({ open, testName, onCancel, onPick }: RunModePickerModalProps) {
  // Backend supports headed/headless. Defaulted to headless. The toggle below
  // surfaces the choice as a switch row (closest to the prototype's pattern,
  // since the design itself doesn't show a headed/headless control).
  const [headed, setHeaded] = useState(false);
  const [browser, setBrowser] = useState('chromium');
  const [viewport, setViewport] = useState('desktop');
  const [concurrency, setConcurrency] = useState('4');
  const [retries, setRetries] = useState('1');
  const [captureVideo, setCaptureVideo] = useState(true);
  const [captureNetwork, setCaptureNetwork] = useState(true);
  const [bisect, setBisect] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleStart = () => onPick(headed ? 'headed' : 'headless');

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Run "{testName}"</h3>
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
          <div className="field-row">
            <div className="field">
              <label>
                Browser
              </label>
              <select value={browser} onChange={(e) => setBrowser(e.target.value)}>
                <option value="chromium">Chromium</option>
                <option value="firefox" disabled>Firefox (soon)</option>
                <option value="webkit" disabled>WebKit (soon)</option>
              </select>
            </div>
            <div className="field">
              <label>
                Viewport <SoonPill />
              </label>
              <select
                value={viewport}
                onChange={(e) => setViewport(e.target.value)}
                disabled
              >
                <option value="desktop">Desktop · 1280×720</option>
                <option value="tablet">Tablet · 1024×768</option>
                <option value="mobile">Mobile · 390×844</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>
                Concurrency <SoonPill />
              </label>
              <select
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                disabled
              >
                <option value="4">4 parallel</option>
                <option value="2">2 parallel</option>
                <option value="1">1</option>
              </select>
            </div>
            <div className="field">
              <label>
                Retries <SoonPill />
              </label>
              <select
                value={retries}
                onChange={(e) => setRetries(e.target.value)}
                disabled
              >
                <option value="1">1 on failure</option>
                <option value="2">2 on failure</option>
                <option value="0">None</option>
              </select>
            </div>
          </div>

          <SwitchRow
            label="Run headed (visible browser)"
            on={headed}
            onChange={setHeaded}
          />
          <SwitchRow
            label="Capture video"
            on={captureVideo}
            onChange={setCaptureVideo}
          />
          <SwitchRow
            label="Capture network log"
            on={captureNetwork}
            onChange={setCaptureNetwork}
            soon
          />
          <SwitchRow
            label="Bisect mode (find first failing commit)"
            on={bisect}
            onChange={setBisect}
            soon
          />
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleStart}>
            <Play size={13} />
            <span>Start run</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  on,
  onChange,
  soon,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  soon?: boolean;
}) {
  return (
    <label
      className="row"
      style={{
        gap: 10,
        cursor: soon ? 'not-allowed' : 'pointer',
        opacity: soon ? 0.6 : 1,
      }}
    >
      <button
        type="button"
        className={`switch ${on ? 'on' : ''}`}
        onClick={() => !soon && onChange(!on)}
        aria-pressed={on}
        disabled={soon}
        style={{ border: 0, padding: 0 }}
      />
      <span style={{ fontSize: 12, color: 'var(--ink)' }}>{label}</span>
      {soon && <SoonPill />}
    </label>
  );
}

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
