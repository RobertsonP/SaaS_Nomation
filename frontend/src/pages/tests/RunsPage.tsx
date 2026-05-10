import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, FlaskConical, Layers, Loader2 } from 'lucide-react';
import { executionAPI, projectsAPI, testsAPI, testSuitesAPI } from '../../lib/api';
import { Pill, PillKind } from '../../components/ui/Pill';
import { useNotification } from '../../contexts/NotificationContext';
import { createLogger } from '../../lib/logger';

const logger = createLogger('RunsPage');

interface RunRow {
  executionId: string;
  kind: 'test' | 'suite';
  targetId: string; // testId or suiteId
  targetName: string;
  status: string;
  startedAt: string;
  duration?: number;
  passed?: number;
  failed?: number;
  total?: number;
}

interface Project {
  id: string;
  name: string;
}

function statusPillKind(status: string): PillKind {
  if (status === 'passed' || status === 'ok') return 'ok';
  if (status === 'failed' || status === 'fail') return 'err';
  if (status === 'running') return 'info';
  return 'mute';
}

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

function formatWhen(date: string): string {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function RunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();
  const [project, setProject] = useState<Project | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'test' | 'suite'>('all');

  useEffect(() => {
    if (!projectId) return;
    loadRuns();
  }, [projectId]);

  const loadRuns = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      // Fetch project metadata + all tests + all suites
      const [projectResponse, testsResponse, suitesResponse] = await Promise.all([
        projectsAPI.getById(projectId),
        testsAPI.getByProject(projectId),
        testSuitesAPI.getByProject(projectId),
      ]);
      setProject(projectResponse.data);

      const tests = Array.isArray(testsResponse.data) ? testsResponse.data : [];
      const suites = Array.isArray(suitesResponse.data) ? suitesResponse.data : [];

      // Fan out execution fetches for each test + each suite, in parallel
      const testExecPromises = tests.map(async (t: any) => {
        try {
          const r = await executionAPI.getResults(t.id);
          const list = Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
          return list.map((ex: any) => ({
            executionId: ex.id,
            kind: 'test' as const,
            targetId: t.id,
            targetName: t.name,
            status: ex.status,
            startedAt: ex.startedAt,
            duration: ex.duration,
          } as RunRow));
        } catch (err) {
          logger.warn(`Failed to load executions for test ${t.id}`, err);
          return [] as RunRow[];
        }
      });

      const suiteExecPromises = suites.map(async (s: any) => {
        try {
          const r = await testSuitesAPI.getExecutions(s.id);
          const list = Array.isArray(r.data) ? r.data : (r.data?.results ?? []);
          return list.map((ex: any) => ({
            executionId: ex.id,
            kind: 'suite' as const,
            targetId: s.id,
            targetName: s.name,
            status: ex.status,
            startedAt: ex.startedAt,
            duration: ex.duration,
            passed: ex.passedTests ?? ex.passed,
            failed: ex.failedTests ?? ex.failed,
            total: ex.totalTests ?? ex.total,
          } as RunRow));
        } catch (err) {
          logger.warn(`Failed to load executions for suite ${s.id}`, err);
          return [] as RunRow[];
        }
      });

      const allLists = await Promise.all([...testExecPromises, ...suiteExecPromises]);
      const merged = allLists.flat();
      merged.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      setRuns(merged);
    } catch (err) {
      logger.error('Failed to load runs', err);
      showError('Loading Failed', 'Could not load execution history.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? runs : runs.filter((r) => r.kind === filter);

  const handleRowClick = (run: RunRow) => {
    if (run.kind === 'test') {
      navigate(`/tests/${run.targetId}/results`);
    } else {
      navigate(`/suites/${run.targetId}/results`);
    }
  };

  return (
    <div className="content">
      <div className="page-head">
        <div>
          {project?.id && (
            <Link
              to={`/projects/${project.id}`}
              className="dim"
              style={{
                fontSize: 11.5,
                textDecoration: 'none',
                display: 'inline-block',
                marginBottom: 4,
              }}
            >
              ← Back to project
            </Link>
          )}
          <h1>Runs</h1>
          {project?.name && (
            <div className="sub">
              {project.name} · execution history across tests and suites
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={loadRuns}
            disabled={loading}
            style={loading ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
            <span>{loading ? 'Loading…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="row" style={{ gap: 8 }}>
            <span className="card-title">Recent runs</span>
            <Pill kind="mute" dot={false}>{runs.length}</Pill>
          </div>
          <div className="row" style={{ gap: 4 }}>
            {(['all', 'test', 'suite'] as const).map((f) => {
              const active = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    background: active ? 'var(--surface-2)' : 'transparent',
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: active ? 600 : 500,
                  }}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="empty" style={{ padding: '40px 16px' }}>
            <div className="empty-icon">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <p>Loading runs…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty" style={{ padding: '32px 16px' }}>
            <div className="empty-icon">
              <Activity size={20} />
            </div>
            <h3>No runs yet</h3>
            <p>
              Run a test or a suite to see executions here.{' '}
              {project?.id && (
                <>
                  <Link to={`/projects/${project.id}/tests`}>Tests</Link> ·{' '}
                  <Link to={`/projects/${project.id}/suites`}>Suites</Link>
                </>
              )}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Run</th>
                <th>Target</th>
                <th>Type</th>
                <th>Pass / Fail</th>
                <th>Status</th>
                <th className="num">Duration</th>
                <th className="num">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.executionId}
                  onClick={() => handleRowClick(r)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="mono dim" style={{ fontSize: 11 }}>
                    {r.executionId.slice(0, 8)}
                  </td>
                  <td style={{ fontWeight: 500 }}>{r.targetName}</td>
                  <td className="dim">
                    <span className="row" style={{ gap: 4, alignItems: 'center' }}>
                      {r.kind === 'suite' ? <Layers size={11} /> : <FlaskConical size={11} />}
                      {r.kind}
                    </span>
                  </td>
                  <td className="mono">
                    {r.kind === 'suite' && r.passed !== undefined && r.failed !== undefined ? (
                      <>
                        <span style={{ color: 'var(--moss)' }}>{r.passed}</span>
                        <span className="dim"> / </span>
                        <span style={{ color: 'var(--clay)' }}>{r.failed}</span>
                      </>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                  <td>
                    <Pill kind={statusPillKind(r.status)} dot={false}>
                      {r.status}
                    </Pill>
                  </td>
                  <td className="num mono">{formatDuration(r.duration)}</td>
                  <td className="num dim">{formatWhen(r.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
