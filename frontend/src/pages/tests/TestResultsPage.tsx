import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { executionAPI, testsAPI, reportingAPI } from '../../lib/api'
import { RobotFrameworkResults } from '../../components/test-results/RobotFrameworkResults'
import { LiveExecutionViewer } from '../../components/execution/LiveExecutionViewer'
import { ExecutionVideoPlayer } from '../../components/execution/ExecutionVideoPlayer'
import { useTestExecution } from '../../hooks/useTestExecution'
import { useNotification } from '../../contexts/NotificationContext'
import { FileText, Mail, Download } from 'lucide-react'
import { createLogger } from '../../lib/logger'

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
  const [liveExecutionTest, setLiveExecutionTest] = useState<{id: string; name: string} | null>(null)
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

  const loadTestAndResults = async () => {
    try {
      const [testResponse, executionsResponse] = await Promise.all([
        testsAPI.getById(testId!),
        executionAPI.getResults(testId!)
      ])
      setTest(testResponse.data)
      setExecutions(executionsResponse.data)
      
      // Auto-select latest execution if none selected
      if (!selectedExecution && executionsResponse.data.length > 0) {
        setSelectedExecution(executionsResponse.data[0])
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

  const handleRunTestLive = async () => {
    if (!test) return
    // Open live execution viewer
    setLiveExecutionTest({ id: test.id, name: test.name })
  }

  const handleLiveExecutionComplete = (result: any) => {
    logger.info('Live execution completed', result)
    // Reload the test results to show the new execution
    loadTestAndResults()
  }

  const closeLiveExecution = () => {
    setLiveExecutionTest(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-100'
      case 'failed': return 'text-red-600 bg-red-100'
      case 'running': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDuration = (duration?: number) => {
    if (!duration) return 'N/A'
    return `${(duration / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test results...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to={`/projects/${test?.project.id}/tests`} className="text-blue-600 hover:text-blue-800">
            ← Back to Tests
          </Link>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{test?.name}</h1>
            <p className="text-gray-600 mt-2">Project: {test?.project.name}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleRunTest}
              disabled={isExecuting}
              className={`px-4 py-2 rounded-lg text-white ${
                isExecuting 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {isExecuting ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>
                    {executionState?.status === 'waiting' ? `Queued (#${executionState.position})` :
                     executionState?.status === 'active' ? `Running (${executionState.progress}%)` :
                     'Running...'}
                  </span>
                </div>
              ) : 'Run Test'}
            </button>
            <button
              onClick={handleRunTestLive}
              className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-1"
              title="Run with live viewport viewer"
            >
              <span>🎬</span>
              <span>Live View</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Execution History */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Execution History</h2>
            </div>
            <div className="divide-y max-h-96 overflow-y-auto">
              {executions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No executions yet
                </div>
              ) : (
                executions.map((execution) => (
                  <div
                    key={execution.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedExecution?.id === execution.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedExecution(execution)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status.toUpperCase()}
                          </span>
                          
                          {/* Report Buttons */}
                          {execution.status !== 'running' && (
                            <div className="flex space-x-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDownloadReport(execution.id)
                                }}
                                disabled={isDownloading}
                                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Download PDF Report"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEmailReport(execution.id)
                                }}
                                disabled={isEmailing}
                                className="p-1 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                                title="Email Report"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {new Date(execution.startedAt).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Duration: {formatDuration(execution.duration)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Robot Framework Style Results */}
        <div className="lg:col-span-2">
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
              <RobotFrameworkResults
                execution={selectedExecution}
                testName={test?.name || 'Unknown Test'}
                testSteps={test?.steps || []}
                projectId={test?.project.id}
                onStepClick={(timestamp) => setSeekTimestamp(timestamp)}
              />
            </>
          ) : (
            <div className="bg-white rounded-lg shadow border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Select an execution to view details</h2>
              </div>
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-lg mb-2">Professional Test Results</p>
                <p className="text-sm">Select an execution from the history to view Robot Framework-style results</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Live Execution Viewer */}
      {liveExecutionTest && (
        <LiveExecutionViewer
          testId={liveExecutionTest.id}
          testName={liveExecutionTest.name}
          isOpen={!!liveExecutionTest}
          onClose={closeLiveExecution}
          onExecutionComplete={handleLiveExecutionComplete}
        />
      )}
    </div>
  )
}