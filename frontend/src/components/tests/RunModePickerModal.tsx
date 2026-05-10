import { useEffect, useState } from 'react';
import {
  Camera,
  Chrome,
  Eye,
  EyeOff,
  Gauge,
  Loader,
  Monitor,
  Play,
  Repeat,
  Smartphone,
  Tablet,
  Timer,
  Video,
  X,
} from 'lucide-react';

interface RunModePickerModalProps {
  open: boolean;
  testName: string;
  onCancel: () => void;
  // Backward-compatible: callsites only need to handle the mode. The advanced
  // options below are exposed in the UI so future versions can wire them.
  onPick: (mode: 'headed' | 'headless') => void;
}

type Browser = 'chromium' | 'firefox' | 'webkit';
type Viewport = 'desktop' | 'tablet' | 'mobile';

export function RunModePickerModal({ open, testName, onCancel, onPick }: RunModePickerModalProps) {
  const [mode, setMode] = useState<'headed' | 'headless'>('headed');
  const [browser, setBrowser] = useState<Browser>('chromium');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [recordVideo, setRecordVideo] = useState(true);
  const [screenshotsOnFailure, setScreenshotsOnFailure] = useState(true);
  const [slowMotionMs, setSlowMotionMs] = useState(0);
  const [stepTimeoutSec, setStepTimeoutSec] = useState(30);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleStart = () => onPick(mode);

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
              <Play size={16} />
            </span>
            <div>
              <div className="modal-title">Run "{testName}"</div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Choose run mode and tweak execution options.
              </div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close">
            <X size={14} />
          </button>
        </div>

        <div className="modal-body col" style={{ gap: 18, overflowY: 'auto' }}>
          {/* Run mode */}
          <Section label="Run mode" required>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ChoiceCard
                active={mode === 'headed'}
                onClick={() => setMode('headed')}
                Icon={Eye}
                title="Headed"
                tone="info"
                description="Real Chromium window opens on the host. Watch the test execute live. Falls back to headless if no display."
              />
              <ChoiceCard
                active={mode === 'headless'}
                onClick={() => setMode('headless')}
                Icon={EyeOff}
                title="Headless"
                tone="moss"
                description="No browser window opens. Same recording, same step-by-step progress streamed to the modal. Faster on busy machines."
              />
            </div>
          </Section>

          {/* Browser */}
          <Section label="Browser engine">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <SmallChoice
                active={browser === 'chromium'}
                onClick={() => setBrowser('chromium')}
                Icon={Chrome}
                title="Chromium"
              />
              <SmallChoice
                active={browser === 'firefox'}
                onClick={() => setBrowser('firefox')}
                Icon={Chrome}
                title="Firefox"
                soon
              />
              <SmallChoice
                active={browser === 'webkit'}
                onClick={() => setBrowser('webkit')}
                Icon={Chrome}
                title="WebKit"
                soon
              />
            </div>
          </Section>

          {/* Viewport */}
          <Section label="Viewport preset">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <SmallChoice
                active={viewport === 'desktop'}
                onClick={() => setViewport('desktop')}
                Icon={Monitor}
                title="Desktop"
                subtitle="1280 × 720"
              />
              <SmallChoice
                active={viewport === 'tablet'}
                onClick={() => setViewport('tablet')}
                Icon={Tablet}
                title="Tablet"
                subtitle="820 × 1180"
                soon
              />
              <SmallChoice
                active={viewport === 'mobile'}
                onClick={() => setViewport('mobile')}
                Icon={Smartphone}
                title="Mobile"
                subtitle="390 × 844"
                soon
              />
            </div>
          </Section>

          {/* Capture */}
          <Section label="Capture">
            <div className="col" style={{ gap: 8 }}>
              <ToggleRow
                Icon={Video}
                title="Record video"
                description="Save a recording of the run. Used for both headed and headless."
                checked={recordVideo}
                onChange={setRecordVideo}
              />
              <ToggleRow
                Icon={Camera}
                title="Screenshot on failure"
                description="Capture a screenshot the moment a step fails."
                checked={screenshotsOnFailure}
                onChange={setScreenshotsOnFailure}
              />
            </div>
          </Section>

          {/* Timing */}
          <Section label="Timing & retries">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <NumberField
                Icon={Timer}
                label="Step timeout"
                suffix="s"
                value={stepTimeoutSec}
                onChange={setStepTimeoutSec}
                min={5}
                max={300}
                step={5}
                soon
              />
              <NumberField
                Icon={Gauge}
                label="Slow-mo"
                suffix="ms"
                value={slowMotionMs}
                onChange={setSlowMotionMs}
                min={0}
                max={2000}
                step={50}
                soon
              />
              <NumberField
                Icon={Repeat}
                label="Retries on fail"
                suffix=""
                value={retries}
                onChange={setRetries}
                min={0}
                max={5}
                step={1}
                soon
              />
            </div>
          </Section>

          <div
            className="row"
            style={{
              gap: 8,
              alignItems: 'flex-start',
              padding: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--hair)',
              borderRadius: 6,
              fontSize: 11.5,
              color: 'var(--ink-3)',
            }}
          >
            <Loader size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              Options marked <strong style={{ color: 'var(--ink-2)' }}>soon</strong> are visible
              now and will be wired in an upcoming release. Run mode and capture toggles work
              today.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleStart}>
            <Play size={13} />
            <span>Start run ({mode})</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="col" style={{ gap: 6 }}>
      <div
        className="dim"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--clay)', marginLeft: 4 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  Icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Eye;
  title: string;
  description: string;
  tone: 'info' | 'moss';
}) {
  const toneFg = tone === 'info' ? 'var(--info)' : 'var(--moss)';
  const toneBg = tone === 'info' ? 'var(--info-soft)' : 'var(--moss-soft)';
  const toneEdge = tone === 'info' ? 'var(--info-edge)' : 'var(--moss-edge)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: active ? toneBg : 'var(--surface)',
        border: `1px solid ${active ? toneFg : 'var(--hair)'}`,
        borderRadius: 8,
        padding: 14,
        cursor: 'pointer',
        transition: 'border-color .15s ease, background .15s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = toneFg;
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--hair)';
        }
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <Icon size={14} style={{ color: toneFg }} />
        <span
          style={{
            fontFamily: 'Inter Tight',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ink)',
          }}
        >
          {title}
        </span>
      </div>
      <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.55 }}>
        {description}
      </div>
    </button>
  );
}

function SmallChoice({
  active,
  onClick,
  Icon,
  title,
  subtitle,
  soon,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Monitor;
  title: string;
  subtitle?: string;
  soon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      style={{
        textAlign: 'left',
        background: active ? 'var(--moss-soft)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--moss)' : 'var(--hair)'}`,
        borderRadius: 6,
        padding: 10,
        cursor: soon ? 'not-allowed' : 'pointer',
        opacity: soon ? 0.6 : 1,
        transition: 'border-color .12s ease, background .12s ease',
        position: 'relative',
      }}
    >
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 2 }}>
        <Icon size={12} style={{ color: active ? 'var(--moss)' : 'var(--ink-2)' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{title}</span>
        {soon && <SoonPill />}
      </div>
      {subtitle && (
        <div className="mono dim" style={{ fontSize: 10.5 }}>
          {subtitle}
        </div>
      )}
    </button>
  );
}

function ToggleRow({
  Icon,
  title,
  description,
  checked,
  onChange,
}: {
  Icon: typeof Video;
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className="row"
      style={{
        gap: 10,
        alignItems: 'flex-start',
        padding: 10,
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      <Icon size={13} style={{ color: 'var(--ink-2)', marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <p className="dim" style={{ margin: '2px 0 0', fontSize: 11.5, lineHeight: 1.5 }}>
          {description}
        </p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: 'var(--moss)', flexShrink: 0, marginTop: 2 }}
      />
    </label>
  );
}

function NumberField({
  Icon,
  label,
  suffix,
  value,
  onChange,
  min,
  max,
  step,
  soon,
}: {
  Icon: typeof Timer;
  label: string;
  suffix: string;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
  soon?: boolean;
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hair)',
        borderRadius: 6,
        padding: 10,
        opacity: soon ? 0.7 : 1,
      }}
    >
      <div className="row" style={{ gap: 6, alignItems: 'center', marginBottom: 4 }}>
        <Icon size={12} style={{ color: 'var(--ink-2)' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        {soon && <SoonPill />}
      </div>
      <div className="row" style={{ gap: 4, alignItems: 'baseline' }}>
        <input
          type="number"
          className="field tabular"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          style={{ flex: 1, fontSize: 12.5 }}
        />
        {suffix && (
          <span className="dim" style={{ fontSize: 11 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SoonPill() {
  return (
    <span
      style={{
        marginLeft: 'auto',
        padding: '1px 6px',
        borderRadius: 999,
        background: 'var(--amber-soft)',
        color: 'var(--amber)',
        border: '1px solid var(--amber-edge)',
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      soon
    </span>
  );
}
