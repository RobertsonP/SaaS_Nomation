import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { Layers, Loader2, Play } from 'lucide-react'
import { testSuitesAPI, projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { useSuiteExecutionContext } from '../../contexts/SuiteExecutionContext'
import { SuiteExecutionReport } from '../../components/test-results/SuiteExecutionReport'
import { Pill, PillKind } from '../../components/ui/Pill'

interface SuiteExecution {
  id: string
  status: 'running' | 'passed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  totalTests: number
  passedTests: number
  failedTests: number
  errorMsg?: string
  results?: any
}

interface TestSuite {
  id: string
  name: string
  description?: string
  project: {
    id: string
    name: string
  }
}

export function SuiteResultsPage() {
  const { suiteId } = useParams<{ suiteId: string }>()
  const { showError, showSuccess } = useNotification()
  const { active: activeSuiteRun, startTracking, minimize: minimizeSuiteRun } = useSuiteExecutionContext()

  const [testSuite, setTestSuite] = useState<TestSuite | null>(null)
  const [executions, setExecutions] = useState<SuiteExecution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<SuiteExecution | null>(null)
  const [loading, setLoading] = useState(true)

  // Derive a simple "is running" flag from either the latest execution row
  // or the suite-execution context (preferred when this suite is the one
  // being tracked).
  const isRunning =
    (activeSuiteRun?.suiteId === suiteId && activeSuiteRun?.status === 'running') ||
    executions.some((e) => e.status === 'running');

  useEffect(() => {
    if (suiteId) {
      loadSuiteAndResults()
    }
  }, [suiteId])

  // Socket.IO subscription so background-completed suites auto-refresh the page.
  const socketRef = useRef<Socket | null>(null)
  useEffect(() => {
    if (!suiteId) return

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3002'
    const wsBase = apiBase.replace(/\/api\/?$/, '')
    const socket = io(`${wsBase}/execution-progress`, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('subscribe-to-suite', suiteId)
    })

    socket.on('execution-progress', (event: any) => {
      if (event?.type !== 'suite') return
      if (event?.status === 'completed') {
        loadSuiteAndResults()
        const { passed, failed, suiteName } = event.details || {}
        showSuccess('Suite Completed', `${suiteName || 'Suite'} finished — ${passed ?? 0} passed, ${failed ?? 0} failed.`)
      } else if (event?.status === 'error') {
        loadSuiteAndResults()
        showError('Suite Failed', `${event.details?.suiteName || 'Suite'} failed during execution.`)
      } else if (event?.status === 'progress') {
        loadSuiteAndResults()
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [suiteId])

  const loadSuiteAndResults = async () => {
    try {
      const [suiteResponse, executionsResponse] = await Promise.all([
        testSuitesAPI.getById(suiteId!),
        testSuitesAPI.getExecutions(suiteId!)
      ])
      setTestSuite(suiteResponse.data)
      setExecutions(executionsResponse.data)
    } catch (error) {
      console.error('Failed to load suite results:', error)
      showError('Loading Failed', 'Failed to load suite execution results')
    } finally {
      setLoading(false)
    }
  }

  const runSuite = async () => {
    if (isRunning || !testSuite) return;
    try {
      const response = await testSuitesAPI.execute(suiteId!)
      const executionId =
        response?.data?.executionId ?? response?.data?.id ?? response?.data?.execution?.id;
      if (executionId) {
        startTracking({
          suiteId: suiteId!,
          suiteName: testSuite.name,
          executionId,
          testsTotal: 0,
        });
      }

      // Poll for updates every 3 seconds for 60 seconds
      let pollCount = 0
      const maxPolls = 20
      const pollInterval = setInterval(async () => {
        await loadSuiteAndResults()
        pollCount++

        if (pollCount >= maxPolls) {
          clearInterval(pollInterval)
        }
      }, 3000)

    } catch (error) {
      console.error('Failed to run suite:', error)
      showError('Execution Failed', 'Failed to start suite execution')
    }
  }

  const getStatusKind = (status: string): PillKind => {
    switch (status) {
      case 'passed': return 'ok'
      case 'failed': return 'err'
      case 'running': return 'info'
      default: return 'mute'
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A'
    return `${(duration / 1000).toFixed(1)}s`
  }

  const getPassRate = (execution: SuiteExecution) => {
    if (execution.totalTests === 0) return '0%'
    return `${Math.round((execution.passedTests / execution.totalTests) * 100)}%`
  }

  if (loading) {
    return (
      <div className="content">
        <div className="row" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          {testSuite?.project?.id && (
            <Link
              to={`/projects/${testSuite.project.id}/suites`}
              className="dim"
              style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
            >
              ← Back to Test Suites
            </Link>
          )}
          {selectedExecution && (
            <div className="row" style={{ marginBottom: 4, gap: 8 }}>
              <Pill kind={getStatusKind(selectedExecution.status)} dot={false}>
                {selectedExecution.status}
              </Pill>
              <span className="dim mono" style={{ fontSize: 11 }}>
                run_{selectedExecution.id.slice(0, 8)}
              </span>
            </div>
          )}
          <h1>{testSuite?.name || 'Suite results'}</h1>
          {testSuite?.project?.name && (
            <div className="sub">
              {testSuite.project.name}
              {testSuite.description ? ` · ${testSuite.description}` : ''}
            </div>
          )}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {isRunning && activeSuiteRun?.suiteId === suiteId && (
            <button
              type="button"
              onClick={minimizeSuiteRun}
              className="btn btn-outline btn-sm"
              title="Minimize — execution continues in the background"
            >
              <span>Minimize</span>
            </button>
          )}
          <button
            type="button"
            onClick={runSuite}
            className="btn btn-primary"
            disabled={isRunning}
            style={isRunning ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
          >
            {isRunning ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Run Suite</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="split-2"
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}
      >
        <div className="card">
          <div className="card-head">
            <span className="card-title">Execution History</span>
            <span className="dim tabular" style={{ fontSize: 11 }}>
              {executions.length}
            </span>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto' }}>
            {executions.length === 0 ? (
              <div className="empty" style={{ padding: '24px 16px' }}>
                <div className="empty-icon">
                  <Layers size={18} />
                </div>
                <h3>No executions yet</h3>
                <p>Click "Run Suite" to start the first run.</p>
              </div>
            ) : (
              executions.map((execution) => {
                const isSelected = selectedExecution?.id === execution.id;
                return (
                  <button
                    key={execution.id}
                    type="button"
                    onClick={() => setSelectedExecution(execution)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--hair)',
                      background: isSelected ? 'var(--surface-2)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <Pill kind={getStatusKind(execution.status)} dot={false}>
                      {execution.status}
                    </Pill>
                    <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                      {new Date(execution.startedAt).toLocaleString()}
                    </div>
                    <div className="col" style={{ marginTop: 4, gap: 2, fontSize: 10.5 }}>
                      <span className="dim tabular">
                        Duration: {formatDuration(execution.duration)}
                      </span>
                      <span className="tabular" style={{ color: 'var(--moss)' }}>
                        ✓ {execution.passedTests} passed
                      </span>
                      <span className="tabular" style={{ color: 'var(--clay)' }}>
                        ✗ {execution.failedTests} failed
                      </span>
                      <span className="dim tabular">Pass rate: {getPassRate(execution)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div>
          {selectedExecution ? (
            <SuiteExecutionReport
              execution={selectedExecution}
              suiteName={testSuite?.name || 'Unknown Suite'}
            />
          ) : (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Select an execution</span>
              </div>
              <div className="empty">
                <div className="empty-icon">
                  <Layers size={20} />
                </div>
                <h3>No execution selected</h3>
                <p>Pick a run from the history on the left to see its per-test breakdown.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}