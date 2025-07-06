import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { executionAPI, testsAPI } from '../../lib/api'

interface TestExecution {
  id: string
  status: 'running' | 'passed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  errorMsg?: string
  results?: any[]
}

interface Test {
  id: string
  name: string
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
          <button
            onClick={runTest}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            Run Test
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

        {/* Execution Details */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">
                {selectedExecution ? 'Execution Details' : 'Select an execution to view details'}
              </h2>
            </div>
            <div className="p-4">
              {selectedExecution ? (
                <div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedExecution.status)}`}>
                        {selectedExecution.status.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Duration</label>
                      <p className="text-sm">{formatDuration(selectedExecution.duration)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Started At</label>
                      <p className="text-sm">{new Date(selectedExecution.startedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Completed At</label>
                      <p className="text-sm">
                        {selectedExecution.completedAt 
                          ? new Date(selectedExecution.completedAt).toLocaleString() 
                          : 'Still running...'
                        }
                      </p>
                    </div>
                  </div>

                  {selectedExecution.errorMsg && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Error Message</label>
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-700">{selectedExecution.errorMsg}</p>
                      </div>
                    </div>
                  )}

                  {selectedExecution.results && selectedExecution.results.length > 0 && (
                    <div>
                      <h3 className="text-md font-medium mb-3">Step Results</h3>
                      <div className="space-y-2">
                        {selectedExecution.results.map((result, index) => (
                          <div
                            key={index}
                            className={`border rounded-lg p-3 ${
                              result.status === 'passed' 
                                ? 'border-green-200 bg-green-50'
                                : result.status === 'failed'
                                ? 'border-red-200 bg-red-50'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-sm">{result.description}</p>
                                {result.selector && (
                                  <p className="text-xs text-gray-600">Selector: {result.selector}</p>
                                )}
                                {result.value && (
                                  <p className="text-xs text-gray-600">Value: {result.value}</p>
                                )}
                                {result.error && (
                                  <p className="text-xs text-red-600 mt-1">{result.error}</p>
                                )}
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                result.status === 'passed' ? 'bg-green-100 text-green-800' :
                                result.status === 'failed' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {result.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>Select an execution from the history to view detailed results</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}