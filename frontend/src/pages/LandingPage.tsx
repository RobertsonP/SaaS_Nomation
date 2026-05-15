import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  ChevronRight,
  Eye,
  Github,
  Sparkles,
  Target,
  Video,
  Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Pill } from '../components/ui/Pill';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bone)', color: 'var(--ink)' }}>
      {/* Navigation */}
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          className="brand"
          style={{ textDecoration: 'none', fontSize: 15 }}
        >
          <div className="brand-mark" />
          <span>Nomation</span>
        </Link>
        <div className="row" style={{ gap: 6 }}>
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              <span>Go to Dashboard</span>
              <ChevronRight size={13} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                <span>Sign up</span>
                <ChevronRight size={13} />
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <header
        style={{
          maxWidth: 980,
          margin: '0 auto',
          padding: '64px 24px 48px',
          textAlign: 'center',
        }}
      >
        <div className="row" style={{ justifyContent: 'center', marginBottom: 18 }}>
          <Pill kind="ok">
            <Sparkles size={11} style={{ marginRight: 2 }} />
            New: AI-Powered Element Discovery
          </Pill>
        </div>

        <h1
          style={{
            fontFamily: 'Inter Tight, sans-serif',
            fontSize: 'clamp(36px, 6vw, 56px)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--ink)',
            margin: '0 0 16px',
          }}
        >
          Bulletproof automated testing for{' '}
          <span style={{ color: 'var(--moss)' }}>modern SaaS</span>
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'var(--ink-2)',
            maxWidth: 640,
            margin: '0 auto 28px',
            lineHeight: 1.55,
          }}
        >
          Create, run, and maintain end-to-end tests in minutes. The AI heals broken
          selectors so your suite never flakes.
        </p>

        <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            <span>Start testing for free</span>
            <ChevronRight size={14} />
          </Link>
          <a href="#features" className="btn btn-outline btn-lg">
            View features
          </a>
        </div>

        {/* Hero showcase — pseudo browser chrome */}
        <div
          className="card"
          style={{
            marginTop: 56,
            overflow: 'hidden',
            textAlign: 'left',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            className="row"
            style={{
              gap: 6,
              padding: '8px 12px',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--hair)',
            }}
          >
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--clay)' }}
            />
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)' }}
            />
            <span
              style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--moss)' }}
            />
            <span
              className="mono"
              style={{
                marginLeft: 12,
                color: 'var(--ink-3)',
                fontSize: 11.5,
                background: 'var(--surface)',
                border: '1px solid var(--hair)',
                borderRadius: 4,
                padding: '2px 8px',
                flex: 1,
              }}
            >
              app.nomation.test/dashboard
            </span>
          </div>
          <div
            style={{
              height: 320,
              display: 'grid',
              placeItems: 'center',
              background:
                'linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)',
              padding: 24,
            }}
          >
            <div className="col" style={{ alignItems: 'center', gap: 8, color: 'var(--ink-3)' }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--moss-soft)',
                  border: '1px solid var(--moss-edge)',
                  color: 'var(--moss)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Video size={22} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' }}>
                Video recording &amp; time-travel debugging built in
              </div>
              <div className="dim" style={{ fontSize: 11.5 }}>
                Every run produces a replay.
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features */}
      <section
        id="features"
        style={{
          background: 'var(--paper)',
          borderTop: '1px solid var(--hair)',
          padding: '64px 0',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2
              style={{
                fontFamily: 'Inter Tight',
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
                margin: 0,
              }}
            >
              Everything you need to ship with confidence
            </h2>
          </div>
          <div
            className="stat-grid-4"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
            }}
          >
            <FeatureCard
              icon={<Bot size={18} />}
              title="AI-Powered Selectors"
              desc="The DOM-aware generator builds selectors that survive UI rewrites."
            />
            <FeatureCard
              icon={<Video size={18} />}
              title="Video Evidence"
              desc="Every run is recorded. Replay failures with our time-travel player."
            />
            <FeatureCard
              icon={<Target size={18} />}
              title="Self-Healing"
              desc="Tests adapt to your code. Broken selectors get automatically retargeted."
            />
            <FeatureCard
              icon={<Github size={18} />}
              title="GitHub Integration"
              desc="Import your repo and we map pages, routes, and elements for you."
            />
            <FeatureCard
              icon={<Zap size={18} />}
              title="Parallel Execution"
              desc="Run hundreds of tests at once on a containerised browser pool."
            />
            <FeatureCard
              icon={<Eye size={18} />}
              title="Visual Reporting"
              desc="Per-step screenshots, logs, and pass/fail trace for every run."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          background: 'var(--paper)',
          borderTop: '1px solid var(--hair)',
          padding: '24px',
        }}
      >
        <div
          className="row"
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div className="row" style={{ gap: 8 }}>
            <div className="brand-mark" />
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>Nomation</span>
          </div>
          <div className="dim" style={{ fontSize: 11.5 }}>
            © {new Date().getFullYear()} Nomation. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: 'var(--moss-soft)',
          color: 'var(--moss)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'Inter Tight',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink)',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}
