import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ChevronRight,
  FlaskConical,
  FolderKanban,
  Info,
  Layers,
  Play,
  Plus,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { projectsAPI } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;
type Step5Mode = 'choose' | 'create-form';

const TOTAL_STEPS = 5;

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [step, setStep] = useState<Step>(1);
  const [step5Mode, setStep5Mode] = useState<Step5Mode>('choose');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  // ESC = skip (consistent with the rest of the modal system)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSkip]);

  const goNext = () => setStep((s) => (s < TOTAL_STEPS ? ((s + 1) as Step) : s));
  const goBack = () => {
    if (step === 5 && step5Mode === 'create-form') {
      setStep5Mode('choose');
      return;
    }
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  };

  const createDemo = async () => {
    setIsSubmitting(true);
    try {
      const response = await projectsAPI.create({
        name: 'Demo Project: Testim.io',
        description: 'A sample project to demonstrate automated testing capabilities.',
        urls: [
          { url: 'https://demo.testim.io/', title: 'Home Page', description: 'Main landing page' },
          {
            url: 'https://demo.testim.io/login',
            title: 'Login Page',
            description: 'Authentication page',
          },
        ],
      });
      showSuccess('Demo created', 'Demo project ready — let’s take a look.');
      onComplete();
      navigate(`/projects/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create demo project:', err);
      showError('Error', 'Failed to create demo project.');
      setIsSubmitting(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await projectsAPI.create({
        name: name.trim(),
        description: 'My first Nomation project',
        urls: [{ url: url.trim(), title: 'Starting Page', description: 'Main entry point' }],
      });
      showSuccess('Project created', `Project "${name.trim()}" is ready.`);
      onComplete();
      navigate(`/projects/${response.data.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
      showError('Error', 'Failed to create project.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onSkip}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}
      >
        {/* Head: eyebrow + dots + skip */}
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
              Onboarding · {step} of {TOTAL_STEPS}
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              Welcome to Nomation
            </h3>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 5 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: n <= step ? 'var(--moss)' : 'var(--hair-2)',
                    transition: 'background 120ms ease',
                  }}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              onClick={onSkip}
              aria-label="Skip onboarding"
              title="Skip onboarding"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body col" style={{ gap: 16, overflowY: 'auto', flex: 1 }}>
          {step === 1 && <Step1Welcome />}
          {step === 2 && <Step2Sidebar />}
          {step === 3 && <Step3PageHeader highlightHelp={false} />}
          {step === 4 && <Step3PageHeader highlightHelp={true} />}
          {step === 5 && (
            <Step5GetStarted
              mode={step5Mode}
              onPickCreate={() => setStep5Mode('create-form')}
              onPickDemo={createDemo}
              onSubmitCreate={createProject}
              name={name}
              setName={setName}
              url={url}
              setUrl={setUrl}
              isSubmitting={isSubmitting}
            />
          )}
        </div>

        {/* Foot */}
        <div className="modal-foot">
          {step > 1 ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm left"
              onClick={goBack}
              disabled={isSubmitting}
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm left"
              onClick={onSkip}
              disabled={isSubmitting}
            >
              Skip onboarding
            </button>
          )}

          {step < 5 && (
            <button type="button" className="btn btn-primary" onClick={goNext}>
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          )}

          {step === 5 && step5Mode === 'choose' && (
            <button type="button" className="btn btn-outline" onClick={onComplete}>
              <span>Finish without a project</span>
            </button>
          )}

          {step === 5 && step5Mode === 'create-form' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => createProject(e as unknown as React.FormEvent)}
              disabled={isSubmitting || !name.trim() || !url.trim()}
            >
              <Plus size={13} />
              <span>{isSubmitting ? 'Creating…' : 'Create project'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------- Step components (kept inside the file to avoid sprawl) -------- */

function Step1Welcome() {
  return (
    <div className="col" style={{ gap: 12, alignItems: 'center', textAlign: 'center', padding: '20px 24px' }}>
      <span
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: 'var(--moss-soft)',
          color: 'var(--moss)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Sparkles size={26} />
      </span>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--ink)' }}>
        Welcome to Nomation
      </h2>
      <p style={{ margin: 0, maxWidth: 460, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)' }}>
        I help you turn any website into a tested-by-default product. Let me show you around — under a minute.
      </p>
      <div
        className="row"
        style={{
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'var(--surface-2)',
          border: '1px solid var(--hair)',
          marginTop: 6,
        }}
      >
        <span className="dim" style={{ fontSize: 11.5 }}>5 steps · ~ 60 seconds</span>
      </div>
    </div>
  );
}

function Step2Sidebar() {
  const items = [
    { icon: <Activity size={14} />, label: 'Dashboard', sub: 'Pass rate, runs in flight, recent activity.' },
    { icon: <FolderKanban size={14} />, label: 'Projects', sub: 'Your URLs, elements, tests, suites — grouped per project.' },
    { icon: <FlaskConical size={14} />, label: 'Tests', sub: 'Build, save, and run individual test cases.' },
    { icon: <Layers size={14} />, label: 'Suites', sub: 'Group tests into batches for regression runs.' },
    { icon: <Play size={14} />, label: 'Runs', sub: 'A unified log of every test and suite execution.' },
    { icon: <Settings size={14} />, label: 'Settings', sub: 'Profile, password, notification preferences.' },
  ];
  return (
    <div className="col" style={{ gap: 12 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          Your workspace at a glance
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
          The left sidebar groups everything. Same six items, every screen.
        </p>
      </div>
      <div
        className="card"
        style={{ padding: 8, background: 'var(--surface-2)', border: '1px solid var(--hair)' }}
      >
        {items.map((it) => (
          <div
            key={it.label}
            className="row"
            style={{
              gap: 10,
              padding: '8px 10px',
              borderRadius: 6,
            }}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                color: 'var(--ink-2)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {it.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{it.label}</div>
              <div className="dim" style={{ fontSize: 11.5 }}>
                {it.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Step3PageHeader({ highlightHelp }: { highlightHelp: boolean }) {
  return (
    <div className="col" style={{ gap: 12 }}>
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          {highlightHelp ? 'Stuck? Click the (i) on any page.' : 'Every page works the same way'}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
          {highlightHelp
            ? 'See what the page does, how it works, and the common actions — without leaving the page.'
            : 'Title and subtitle on the left. Actions and help on the right.'}
        </p>
      </div>

      {/* Mocked .page-head */}
      <div
        className="card card-pad"
        style={{
          background: 'var(--surface-2)',
          border: '1px dashed var(--hair-2)',
        }}
      >
        <div className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 style={{ margin: 0 }}>Example page</h1>
            <div className="sub">Title goes here · subtitle gives context</div>
          </div>
          <div className="row">
            <button type="button" className="btn btn-outline" disabled>
              <Plus size={13} />
              <span>Primary action</span>
            </button>
            <span
              style={{
                display: 'inline-flex',
                borderRadius: 6,
                boxShadow: highlightHelp
                  ? '0 0 0 3px var(--moss-soft), 0 0 0 1px var(--moss)'
                  : 'none',
                transition: 'box-shadow 200ms ease',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                disabled
                title="Help — what does this page do?"
                aria-label="Help"
              >
                <Info size={15} />
              </button>
            </span>
          </div>
        </div>
      </div>

      {highlightHelp && (
        <div
          className="card card-pad"
          style={{
            background: 'var(--moss-soft)',
            border: '1px solid var(--moss-edge)',
          }}
        >
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: 'var(--moss)',
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Info size={13} />
            </span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>
                Every page has this button.
              </div>
              <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                Look for the small <strong>i</strong> in the top-right of the page header. Click it to open a
                side panel with a short guide, common actions, and tips.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface Step5Props {
  mode: Step5Mode;
  onPickCreate: () => void;
  onPickDemo: () => void;
  onSubmitCreate: (e: React.FormEvent) => void;
  name: string;
  setName: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  isSubmitting: boolean;
}

function Step5GetStarted({
  mode,
  onPickCreate,
  onPickDemo,
  onSubmitCreate,
  name,
  setName,
  url,
  setUrl,
  isSubmitting,
}: Step5Props) {
  if (mode === 'choose') {
    return (
      <div className="col" style={{ gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            Let’s set up your first project
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
            You can also do this later — close this tour and use “New project” from the dashboard.
          </p>
        </div>
        <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
          <button
            type="button"
            className="card card-pad col"
            onClick={onPickCreate}
            disabled={isSubmitting}
            style={{
              flex: 1,
              textAlign: 'left',
              gap: 6,
              cursor: 'pointer',
              borderColor: 'var(--hair-2)',
              background: 'var(--surface)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--moss-soft)',
                color: 'var(--moss)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Plus size={14} />
            </span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Create a project</div>
            <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              I have a website I want to test. Set me up with my own URL.
            </div>
          </button>
          <button
            type="button"
            className="card card-pad col"
            onClick={onPickDemo}
            disabled={isSubmitting}
            style={{
              flex: 1,
              textAlign: 'left',
              gap: 6,
              cursor: 'pointer',
              borderColor: 'var(--hair-2)',
              background: 'var(--surface)',
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: 'var(--info-soft, var(--surface-2))',
                color: 'var(--info, var(--ink-2))',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <FlaskConical size={14} />
            </span>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>Try the demo</div>
            <div className="dim" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
              Show me how it works using a sample site (demo.testim.io).
            </div>
          </button>
        </div>
      </div>
    );
  }

  // mode === 'create-form'
  return (
    <form onSubmit={onSubmitCreate} className="col" style={{ gap: 14 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
          What are we testing?
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-3)' }}>
          Give your project a name and one URL to start from. You can add more later.
        </p>
      </div>

      <div className="col" style={{ gap: 5 }}>
        <label
          className="dim"
          style={{
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Project name
        </label>
        <input
          type="text"
          autoFocus
          required
          placeholder="e.g. My E-commerce App"
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid var(--hair-2)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div className="col" style={{ gap: 5 }}>
        <label
          className="dim"
          style={{
            fontSize: 10.5,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Starting URL
        </label>
        <input
          type="url"
          required
          placeholder="https://example.com"
          className="field mono"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{
            padding: '8px 10px',
            border: '1px solid var(--hair-2)',
            borderRadius: 6,
            background: 'var(--surface)',
            color: 'var(--ink)',
            fontSize: 12.5,
            fontFamily: "'Geist Mono', ui-monospace, monospace",
          }}
        />
      </div>
    </form>
  );
}
