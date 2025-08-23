import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { testSuitesAPI, projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { RobotFrameworkSuiteResults } from '../../components/test-results/RobotFrameworkSuiteResults'

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
  const { showError } = useNotification()
  
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null)
  const [executions, setExecutions] = useState<SuiteExecution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<SuiteExecution | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (suiteId) {
      loadSuiteAndResults()
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
    try {
      await testSuitesAPI.execute(suiteId!)
      
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

  const getPassRate = (execution: SuiteExecution) => {
    if (execution.totalTests === 0) return '0%'
    return `${Math.round((execution.passedTests / execution.totalTests) * 100)}%`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading suite results...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to={`/projects/${testSuite?.project.id}/suites`} className="text-blue-600 hover:text-blue-800">
            ← Back to Test Suites
          </Link>
        </div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{testSuite?.name}</h1>
            <p className="text-gray-600 mt-2">Project: {testSuite?.project.name}</p>
            {testSuite?.description && (
              <p className="text-gray-500 mt-1">{testSuite.description}</p>
            )}
          </div>
          <button
            onClick={runSuite}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            ▶️ Run Suite
          </button>
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
                        <div className="text-xs text-gray-500 mt-1 space-y-1">
                          <p>Duration: {formatDuration(execution.duration)}</p>
                          <p>Tests: {execution.totalTests} total</p>
                          <p className="text-green-600">✓ {execution.passedTests} passed</p>
                          <p className="text-red-600">✗ {execution.failedTests} failed</p>
                          <p>Pass Rate: {getPassRate(execution)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Robot Framework Style Suite Results */}
        <div className="lg:col-span-2">
          {selectedExecution ? (
            <RobotFrameworkSuiteResults
              execution={selectedExecution}
              suiteName={testSuite?.name || 'Unknown Suite'}
            />
          ) : (
            <div className="bg-white rounded-lg shadow border">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Select an execution to view details</h2>
              </div>
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">🧪</div>
                <p className="text-lg mb-2">Professional Suite Results</p>
                <p className="text-sm">Select an execution from the history to view Robot Framework-style suite results</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}