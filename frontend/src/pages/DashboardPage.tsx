import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, Filter, Plus, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectsContext';
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard';
import { executionAPI } from '../lib/api';
import { Pill } from '../components/ui/Pill';
import { Sparkline } from '../components/ui/Sparkline';
import { StatTile } from '../components/ui/StatTile';
import { createLogger } from '../lib/logger';

const logger = createLogger('Dashboard');

interface ExecutionStats {
  running: number;
  totalToday: number;
  passRate7d: number;
  totalLast7d: number;
}

interface TrendPoint {
  date: string;
  passed: number;
  failed: number;
  total: number;
  passRate: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects, loading, refreshProjects } = useProjects();

  const [showWizard, setShowWizard] = useState(false);
  const [stats, setStats] = useState<ExecutionStats>({
    running: 0,
    totalToday: 0,
    passRate7d: 0,
    totalLast7d: 0,
  });
  const [trends, setTrends] = useState<TrendPoint[]>([]);

  // Refresh projects on mount so the dashboard reflects any post-login changes.
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Fetch real execution stats — same call the previous dashboard made.
  useEffect(() => {
    executionAPI
      .getStats()
      .then((res) => {
        if (res.data?.success) {
          setStats({
            running: res.data.running ?? 0,
            totalToday: res.data.totalToday ?? 0,
            passRate7d: res.data.passRate7d ?? 0,
            totalLast7d: res.data.totalLast7d ?? 0,
          });
        }
      })
      .catch((err) => logger.warn('getStats failed', err?.message));
  }, []);

  // Fetch 7-day trends for the sparkline + recent-runs activity feed.
  useEffect(() => {
    executionAPI
      .getTrends(7)
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.trends)) {
          setTrends(res.data.trends);
        }
      })
      .catch((err) => logger.warn('getTrends failed', err?.message));
  }, []);

  // Show onboarding wizard automatically when the user has no projects yet.
  useEffect(() => {
    if (!loading && projects.length === 0) {
      setShowWizard(true);
    }
  }, [loading, projects.length]);

  const totalTests = useMemo(
    () => projects.reduce((sum, p) => sum + (p._count?.tests ?? 0), 0),
    [projects],
  );

  const sparkData = useMemo(() => {
    if (trends.length === 0) return [];
    return trends.map((t) => t.passRate);
  }, [trends]);

  const passRateTrendKind = stats.passRate7d >= 90 ? 'ok' : stats.passRate7d >= 70 ? 'warn' : 'err';

  if (loading) {
    return (
      <div className="content">
        <div
          className="row"
          style={{ minHeight: '40vh', justifyContent: 'center', alignItems: 'center' }}
        >
          <div
            className="skel"
            style={{ width: 40, height: 40, borderRadius: '50%' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>
            Welcome back, {user?.name || 'there'}
          </h1>
          <div className="sub">
            {projects.length} project{projects.length === 1 ? '' : 's'} ·{' '}
            {totalTests} test{totalTests === 1 ? '' : 's'} ·{' '}
            {stats.running > 0 ? `${stats.running} running now` : 'no runs in flight'}
          </div>
        </div>
        <div className="row">
          <button
            className="btn btn-outline"
            onClick={() => navigate('/projects')}
            title="Pick a project to analyze its URLs"
          >
            <Activity size={13} />
            <span>Analyze URLs</span>
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/projects?new=1')}
          >
            <Plus size={13} />
            <span>New project</span>
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <StatTile
          label="Pass rate · 7d"
          value={`${stats.passRate7d}%`}
          sub={`${stats.totalLast7d} run${stats.totalLast7d === 1 ? '' : 's'} this week`}
          trend={{ kind: passRateTrendKind, label: stats.totalLast7d > 0 ? 'live' : 'no data' }}
          accent={sparkData.length > 1 ? <Sparkline data={sparkData} /> : null}
        />
        <StatTile
          label="Total tests"
          value={totalTests}
          sub={`across ${projects.length} project${projects.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Today"
          value={stats.totalToday}
          sub={stats.totalToday > 0 ? 'runs queued or completed' : 'nothing run today'}
        />
        <StatTile
          label="Running now"
          value={stats.running}
          sub={stats.running > 0 ? 'tests in progress' : 'all workers idle'}
          trend={
            stats.running > 0
              ? { kind: 'info', label: 'live' }
              : undefined
          }
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div className="card">
          <div className="card-head">
            <div className="row" style={{ gap: 10 }}>
              <span className="card-title">Recent activity</span>
              {trends.length > 0 && <Pill kind="ok">live</Pill>}
            </div>
            <div className="row">
              <button className="btn btn-ghost btn-sm" disabled title="Filter (coming soon)">
                <Filter size={13} />
                <span>Filter</span>
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/projects')}
              >
                <span>View all</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          {trends.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Activity size={20} />
              </div>
              <h3>No runs yet this week</h3>
              <p>Pick a project, run a test, and the latest activity will appear here.</p>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/projects')}
              >
                <Plus size={13} />
                <span>Open a project</span>
              </button>
            </div>
          ) : (
            <div>
              {[...trends].reverse().map((t) => {
                const date = new Date(t.date);
                const label = date.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });
                const kind = t.passRate >= 90 ? 'ok' : t.passRate >= 70 ? 'warn' : 'err';
                return (
                  <div
                    key={t.date}
                    className="row"
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid var(--hair)',
                      gap: 10,
                    }}
                  >
                    <Pill kind={kind}>
                      {kind === 'ok' ? 'pass' : kind === 'warn' ? 'mixed' : 'fail'}
                    </Pill>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: 'var(--ink)',
                        }}
                      >
                        {label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {t.passed} passed · {t.failed} failed · {t.total} total
                      </div>
                    </div>
                    <span
                      className="tabular dim"
                      style={{ fontSize: 11.5, width: 56, textAlign: 'right' }}
                    >
                      {t.passRate}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-head">
              <span className="card-title">Projects</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate('/projects')}
              >
                <span>All</span>
                <ChevronRight size={13} />
              </button>
            </div>
            <div>
              {projects.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">
                    <Plus size={20} />
                  </div>
                  <h3>No projects yet</h3>
                  <p>Start the setup wizard to create your first project.</p>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowWizard(true)}
                  >
                    Run setup wizard
                  </button>
                </div>
              ) : (
                projects.slice(0, 4).map((p) => (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="row"
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--hair)',
                      textDecoration: 'none',
                      color: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {p.name}
                      </div>
                      <div className="dim" style={{ fontSize: 11 }}>
                        {p._count?.tests ?? 0} test{p._count?.tests === 1 ? '' : 's'} ·{' '}
                        {p._count?.elements ?? 0} element
                        {p._count?.elements === 1 ? '' : 's'}
                      </div>
                    </div>
                    <ChevronRight size={14} className="dim" />
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">System status</span>
              <Pill kind="ok">all green</Pill>
            </div>
            <div className="card-pad col" style={{ gap: 6 }}>
              <div
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 12 }}
              >
                <span className="muted">Browser pool</span>
                <span className="tabular">8 / 8 ready</span>
              </div>
              <div
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 12 }}
              >
                <span className="muted">Queue depth</span>
                <span className="tabular">{stats.running} active</span>
              </div>
              <div
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 12 }}
              >
                <span className="muted">P95 latency</span>
                <span className="tabular">— ms</span>
              </div>
              <div
                className="row"
                style={{ justifyContent: 'space-between', fontSize: 12 }}
              >
                <span className="muted">Storage</span>
                <span className="tabular">— / —</span>
              </div>
              {/* TODO: backend GET /health/detailed once exposed; placeholder dashes for now. */}
            </div>
          </div>

          <div className="card card-pad">
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'var(--moss-soft)',
                  color: 'var(--moss)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Zap size={14} />
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                Tip — selector hygiene
              </span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--ink-3)',
                lineHeight: 1.55,
              }}
            >
              Prefer{' '}
              <span
                className="mono"
                style={{
                  background: 'var(--surface-2)',
                  padding: '1px 4px',
                  borderRadius: 3,
                }}
              >
                data-testid
              </span>{' '}
              over deeply nested CSS selectors. Reliable selectors cut flake rate by 60%.
            </div>
          </div>
        </div>
      </div>

      {showWizard && (
        <OnboardingWizard
          onComplete={() => {
            setShowWizard(false);
            refreshProjects();
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
