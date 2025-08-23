import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { executionAPI, testsAPI } from '../../lib/api'
import { RobotFrameworkResults } from '../../components/test-results/RobotFrameworkResults'
import { LiveExecutionViewer } from '../../components/execution/LiveExecutionViewer'

interface TestExecution {
  id: string
  status: 'running' | 'passed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  errorMsg?: string
  results?: any[]
  screenshots?: string[] // Base64 encoded PNG screenshots captured during test execution
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
  const [test, setTest] = useState<Test | null>(null)
  const [executions, setExecutions] = useState<TestExecution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveExecutionTest, setLiveExecutionTest] = useState<{id: string; name: string} | null>(null)

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
    } catch (error) {
      console.error('Failed to load test results:', error)
    } finally {
      setLoading(false)
    }
  }

  const runTest = async () => {
    try {
      await executionAPI.run(testId!)
      
      // Poll for updates every 2 seconds for 30 seconds
      let pollCount = 0
      const maxPolls = 15
      const pollInterval = setInterval(async () => {
        await loadTestAndResults()
        pollCount++
        
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval)
        }
      }, 2000)
      
    } catch (error) {
      console.error('Failed to run test:', error)
      alert('Failed to start test execution')
    }
  }

  const handleRunTestLive = async () => {
    if (!test) return
    // Open live execution viewer
    setLiveExecutionTest({ id: test.id, name: test.name })
  }

  const handleLiveExecutionComplete = (result: any) => {
    console.log('Live execution completed:', result)
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
              onClick={runTest}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
            >
              Run Test
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
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                          {execution.status.toUpperCase()}
                        </span>
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
            <RobotFrameworkResults
              execution={selectedExecution}
              testName={test?.name || 'Unknown Test'}
              testSteps={test?.steps || []}
            />
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