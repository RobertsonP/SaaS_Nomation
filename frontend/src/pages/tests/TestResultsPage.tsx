import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { executionAPI, testsAPI, reportingAPI } from '../../lib/api'
import { TestExecutionReport } from '../../components/test-results/TestExecutionReport'
import { ExecutionVideoPlayer } from '../../components/execution/ExecutionVideoPlayer'
import { useTestExecution } from '../../hooks/useTestExecution'
import { useNotification } from '../../contexts/NotificationContext'
import { Download, Loader2, Mail, Play } from 'lucide-react'
import { createLogger } from '../../lib/logger'
import { Pill, PillKind } from '../../components/ui/Pill'

const logger = createLogger('TestResultsPage')

interface TestExecution {
  id: string
  status: 'running' | 'passed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  errorMsg?: string
  results?: any[]
  screenshots?: string[] // Base64 encoded PNG screenshots captured during test execution
  videoPath?: string
  videoThumbnail?: string
}

interface Test {
  id: string
  name: string
  steps?: Array<{
    id: string
    type: string
    selector: string
    value?: string
    description: string
  }>
  project: {
    id: string
    name: string
  }
}

export function TestResultsPage() {
  const { testId } = useParams<{ testId: string }>()
  const { showSuccess, showError } = useNotification()
  const [test, setTest] = useState<Test | null>(null)
  const [executions, setExecutions] = useState<TestExecution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isEmailing, setIsEmailing] = useState(false)

  const { runTest, executionState, isExecuting, cancelExecution } = useTestExecution()

  const handleDownloadReport = async (executionId: string) => {
    try {
      setIsDownloading(true)
      const response = await reportingAPI.downloadPdf(executionId)
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${executionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      
      showSuccess('Report Downloaded', 'PDF report has been downloaded successfully')
    } catch (error) {
      logger.error('Download failed', error)
      showError('Download Failed', 'Failed to generate PDF report')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleEmailReport = async (executionId: string) => {
    const email = prompt('Enter email address to send report to:')
    if (!email) return

    try {
      setIsEmailing(true)
      await reportingAPI.emailReport(executionId, email)
      showSuccess('Email Sent', `Report sent to ${email}`)
    } catch (error) {
      logger.error('Email failed', error)
      showError('Email Failed', 'Failed to send report email')
    } finally {
      setIsEmailing(false)
    }
  }

  useEffect(() => {
    if (testId) {
      loadTestAndResults()
    }
  }, [testId])

  // Socket.IO subscription so background-completed executions auto-refresh the page.
  const socketRef = useRef<Socket | null>(null)
  useEffect(() => {
    if (!testId) return

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3002'
    const wsBase = apiBase.replace(/\/api\/?$/, '')
    const socket = io(`${wsBase}/execution-progress`, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('subscribe-to-test', testId)
    })

    socket.on('execution-progress', (event: any) => {
      if (event?.type !== 'test') return
      if (event?.status === 'completed' || event?.status === 'failed') {
        loadTestAndResults()
        if (event.status === 'completed') {
          showSuccess('Test Completed', `"${event.details?.testName || 'Test'}" finished successfully.`)
        } else {
          showError('Test Failed', `"${event.details?.testName || 'Test'}" failed. Check the report below.`)
        }
      }
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [testId])

  const loadTestAndResults = async () => {
    try {
      const [testResponse, executionsResponse] = await Promise.all([
        testsAPI.getById(testId!),
        executionAPI.getResults(testId!)
      ])
      setTest(testResponse.data)

      // API returns {success: true, results: [...]} or direct array
      const executionResults = Array.isArray(executionsResponse.data)
        ? executionsResponse.data
        : (executionsResponse.data?.results || [])
      setExecutions(executionResults)

      // Auto-select latest execution if none selected
      if (!selectedExecution && executionResults.length > 0) {
        setSelectedExecution(executionResults[0])
      }
    } catch (error: any) {
      logger.error('Failed to load test results', error)
      if (error.response?.status !== 500) {
        logger.error('Failed to load test results (detailed)', error.response?.data || error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRunTest = async () => {
    if (isExecuting) return

    runTest(testId!, (result) => {
      logger.info('Test execution completed', result)
      // Reload results to show the new execution
      loadTestAndResults()
    })
  }


  const getStatusKind = (status: string): PillKind => {
    switch (status) {
      case 'passed': return 'ok'
      case 'failed': return 'err'
      case 'running': return 'info'
      default: return 'mute'
    }
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

  // Page-head must match pages.jsx:232–245 — status pill + run ID + h1 + sub
  // and action buttons (Download log / Re-run / Open in builder) on the right.
  const sel = selectedExecution;
  const startedAt = sel?.startedAt ? new Date(sel.startedAt) : null;
  const startedLabel = startedAt
    ? (() => {
        const diff = Date.now() - startedAt.getTime();
        if (diff < 60_000) return 'started just now';
        if (diff < 3_600_000) return `started ${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `started ${Math.floor(diff / 3_600_000)}h ago`;
        return `started ${startedAt.toLocaleDateString()}`;
      })()
    : '';
  const ranForLabel = sel?.duration ? `ran for ${formatDuration(sel.duration)}` : '';

  return (
    <div className="content">
      <div className="page-head">
        <div>
          {test?.project?.id && (
            <Link
              to={`/projects/${test.project.id}/tests`}
              className="dim"
              style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
            >
              ← Back to Tests
            </Link>
          )}
          {sel && (
            <div className="row" style={{ marginBottom: 4, gap: 8 }}>
              <Pill kind={getStatusKind(sel.status)} dot={false}>
                {sel.status}
              </Pill>
              <span className="dim mono" style={{ fontSize: 11 }}>
                run_{sel.id.slice(0, 8)}
              </span>
            </div>
          )}
          <h1>{test?.name || 'Test results'}</h1>
          <div className="sub">
            {test?.project?.name && <span>{test.project.name}</span>}
            {startedLabel && (
              <>
                {test?.project?.name && <span> · </span>}
                <span>{startedLabel}</span>
              </>
            )}
            {ranForLabel && (
              <>
                <span> · </span>
                <span>{ranForLabel}</span>
              </>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {sel && sel.status !== 'running' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleDownloadReport(sel.id)}
              disabled={isDownloading}
              style={isDownloading ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              title="Download PDF report"
            >
              <Download size={13} />
              <span>Download</span>
            </button>
          )}
          {sel && sel.status !== 'running' && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => handleEmailReport(sel.id)}
              disabled={isEmailing}
              style={isEmailing ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              title="Email report"
            >
              <Mail size={13} />
              <span>Email</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRunTest}
            disabled={isExecuting}
            className="btn btn-primary"
            style={isExecuting ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
          >
            {isExecuting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>
                  {executionState?.status === 'waiting'
                    ? `Queued (#${executionState.position})`
                    : executionState?.status === 'active'
                      ? `Running (${executionState.progress}%)`
                      : 'Running…'}
                </span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Re-run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {selectedExecution ? (
        <div className="col" style={{ gap: 12 }}>
          <TestExecutionReport
            execution={selectedExecution}
            testName={test?.name || 'Unknown Test'}
          />
          {selectedExecution.videoPath && (
            <ExecutionVideoPlayer
              executionId={selectedExecution.id}
              testName={test?.name || 'Unknown'}
              videoPath={selectedExecution.videoPath}
              thumbnailPath={selectedExecution.videoThumbnail}
              seekToTimestamp={seekTimestamp}
            />
          )}

          {/* Execution history — selectable list of past runs */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Execution history</span>
              <span className="dim tabular" style={{ fontSize: 11 }}>
                {executions.length}
              </span>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {executions.map((execution) => {
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
                    <div
                      className="row"
                      style={{ gap: 10, alignItems: 'center' }}
                    >
                      <Pill kind={getStatusKind(execution.status)} dot={false}>
                        {execution.status}
                      </Pill>
                      <span className="dim mono" style={{ fontSize: 10.5, width: 80 }}>
                        run_{execution.id.slice(0, 8)}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--ink)' }}>
                        {new Date(execution.startedAt).toLocaleString()}
                      </span>
                      <span className="mono dim" style={{ fontSize: 10.5 }}>
                        {formatDuration(execution.duration)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty" style={{ padding: '40px 16px' }}>
            <div className="empty-icon">
              <Play size={20} />
            </div>
            <h3>No executions yet</h3>
            <p>Click "Re-run" to start the first run.</p>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms < 0) return '—';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}