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

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A'
    return `${(duration / 1000).toFixed(1)}s`
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
          {test?.project?.id && (
            <Link
              to={`/projects/${test.project.id}/tests`}
              className="dim"
              style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
            >
              ← Back to Tests
            </Link>
          )}
          <h1>{test?.name || 'Test results'}</h1>
          {test?.project?.name && <div className="sub">Project: {test.project.name}</div>}
        </div>
        <div className="row" style={{ gap: 6 }}>
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
                <span>Run Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className="split-2"
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}
      >
        {/* Execution History */}
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
                  <Play size={18} />
                </div>
                <h3>No executions yet</h3>
                <p>Click "Run Test" to start the first run.</p>
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
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--hair)',
                      background: isSelected ? 'var(--moss-soft)' : 'transparent',
                      borderLeft: isSelected ? '2px solid var(--moss)' : '2px solid transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <div className="row" style={{ justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Pill kind={getStatusKind(execution.status)}>
                          {execution.status.toUpperCase()}
                        </Pill>
                        <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
                          {new Date(execution.startedAt).toLocaleString()}
                        </div>
                        <div className="dim tabular" style={{ fontSize: 10.5 }}>
                          Duration: {formatDuration(execution.duration)}
                        </div>
                      </div>
                      {execution.status !== 'running' && (
                        <div className="row" style={{ gap: 2, flexShrink: 0 }}>
                          <span
                            className="icon-btn"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadReport(execution.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                handleDownloadReport(execution.id);
                              }
                            }}
                            title="Download PDF report"
                            style={isDownloading ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                          >
                            <Download size={13} />
                          </span>
                          <span
                            className="icon-btn"
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEmailReport(execution.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                handleEmailReport(execution.id);
                              }
                            }}
                            title="Email report"
                            style={isEmailing ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
                          >
                            <Mail size={13} />
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Test Execution Report */}
        <div className="col" style={{ gap: 12 }}>
          {selectedExecution ? (
            <>
              {selectedExecution.videoPath && (
                <ExecutionVideoPlayer
                  executionId={selectedExecution.id}
                  testName={test?.name || 'Unknown'}
                  videoPath={selectedExecution.videoPath}
                  thumbnailPath={selectedExecution.videoThumbnail}
                  seekToTimestamp={seekTimestamp}
                />
              )}
              <TestExecutionReport
                execution={selectedExecution}
                testName={test?.name || 'Unknown Test'}
              />
            </>
          ) : (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Select an execution</span>
              </div>
              <div className="empty">
                <div className="empty-icon">
                  <Play size={20} />
                </div>
                <h3>No execution selected</h3>
                <p>Pick a run from the history on the left to see its step-by-step report.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}