import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { testsAPI, projectsAPI } from '../../lib/api'
import { LiveExecutionViewer } from '../../components/execution/LiveExecutionViewer'
import { TestExecutionModal } from '../../components/execution/TestExecutionModal'
import { useTestExecution } from '../../hooks/useTestExecution'
import { TestStep } from '../../types/test.types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('TestsPage')

// Result types for modal callbacks
interface TestExecutionResultCallback {
  status: 'passed' | 'failed' | 'running';
  duration?: number;
}

interface LiveExecutionResultCallback {
  status: 'initializing' | 'running' | 'passed' | 'failed' | 'stopped';
}

interface Test {
  id: string
  name: string
  description?: string
  status: string
  steps: TestStep[]
  createdAt: string
}

interface Project {
  id: string
  name: string
  description?: string
}

export function TestsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [tests, setTests] = useState<Test[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [executingTest, setExecutingTest] = useState<{
    id: string
    name: string
    executionId: string
  } | null>(null)
  const [liveExecutionTest, setLiveExecutionTest] = useState<{id: string; name: string} | null>(null)
  const [newTest, setNewTest] = useState({
    name: '',
    description: '',
    startingUrl: ''
  })

  // Hook for queue-based execution
  const { runTest, executionState, isExecuting } = useTestExecution()
  const [currentlyRunningTestId, setCurrentlyRunningTestId] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) {
      loadProjectAndTests()
    }
  }, [projectId])

  const loadProjectAndTests = async () => {
    try {
      const [projectResponse, testsResponse] = await Promise.all([
        projectsAPI.getById(projectId!),
        testsAPI.getByProject(projectId!)
      ])
      setProject(projectResponse.data)
      setTests(testsResponse.data)
    } catch (error) {
      logger.error('Failed to load project and tests', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await testsAPI.create({
        ...newTest,
        projectId: projectId!,
        steps: []
      })
      setNewTest({ name: '', description: '', startingUrl: '' })
      setShowCreateForm(false)
      loadProjectAndTests()
    } catch (error) {
      logger.error('Failed to create test', error)
    }
  }

  const handleRunTest = async (testId: string) => {
    if (isExecuting) {
      alert('A test is already running. Please wait.')
      return
    }

    setCurrentlyRunningTestId(testId)
    
    // Use the queue hook
    runTest(testId, (result) => {
      logger.info('Test execution completed', result)
      setCurrentlyRunningTestId(null)
      // Reload tests to show status update
      loadProjectAndTests()
      // Optional: Show notification
      alert(`Test execution completed: ${result.success ? 'PASSED' : 'FAILED'}`)
    })
  }

  const handleRunTestLive = async (testId: string, testName: string) => {
    // Open live execution viewer
    setLiveExecutionTest({ id: testId, name: testName })
  }

  const handleDeleteTest = async (testId: string, testName: string) => {
    // Ask for confirmation before deleting
    if (!window.confirm(`Are you sure you want to delete "${testName}"? This action cannot be undone.`)) {
      return
    }

    try {
      await testsAPI.delete(testId)
      // Reload tests after successful deletion
      loadProjectAndTests()
    } catch (error) {
      logger.error('Failed to delete test', error)
      alert('Failed to delete test. Please try again.')
    }
  }

  const handleTestExecutionComplete = (result: TestExecutionResultCallback) => {
    logger.info('Test execution completed', result)
    // Reload tests to show latest execution
    loadProjectAndTests()
  }

  const handleCloseTestExecution = () => {
    setExecutingTest(null)
  }

  const handleLiveExecutionComplete = (result: LiveExecutionResultCallback) => {
    logger.info('Live execution completed', result)
    // Could navigate to results or show success message
  }

  const closeLiveExecution = () => {
    setLiveExecutionTest(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading tests...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to="/projects" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            ← Back to Projects
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{project?.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{project?.description}</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Tests</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Test
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Test</h3>
          <form onSubmit={handleCreateTest}>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Name
                </label>
                <input
                  type="text"
                  required
                  value={newTest.name}
                  onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter test name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTest.description}
                  onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter test description"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Starting URL
                </label>
                <input
                  type="url"
                  required
                  value={newTest.startingUrl}
                  onChange={(e) => setNewTest({ ...newTest, startingUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Test
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
        {tests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No tests created yet</p>
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Test
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y dark:divide-gray-700">
            {tests.map((test) => (
              <div key={test.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{test.name}</h3>
                    {test.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{test.description}</p>
                    )}
                    <div className="flex items-center mt-2 space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {test.steps.length} steps
                      </span>
                      <span className="text-sm text-gray-500">
                        Created {new Date(test.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/projects/${projectId}/tests/${test.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </Link>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleRunTest(test.id)}
                        disabled={test.steps.length === 0 || (isExecuting && currentlyRunningTestId === test.id)}
                        className={`text-sm font-medium px-3 py-1 rounded transition-colors ${
                          test.steps.length === 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : (isExecuting && currentlyRunningTestId === test.id)
                              ? 'bg-blue-100 text-blue-800'
                              : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        }`}
                      >
                        {(isExecuting && currentlyRunningTestId === test.id) ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {executionState?.status === 'waiting' ? `#${executionState.position}` : 'Running'}
                          </span>
                        ) : 'Run'}
                      </button>

                      <button
                        onClick={() => handleRunTestLive(test.id, test.name)}
                        disabled={test.steps.length === 0}
                        className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                          test.steps.length === 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                        title="Run with live viewport viewer"
                      >
                        🎬
                      </button>
                    </div>
                    <Link
                      to={`/tests/${test.id}/results`}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      View Results
                    </Link>
                    <button
                      onClick={() => handleDeleteTest(test.id, test.name)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                      title="Delete test"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Test Execution Modal */}
      {executingTest && (
        <TestExecutionModal
          isOpen={!!executingTest}
          onClose={handleCloseTestExecution}
          testId={executingTest.id}
          testName={executingTest.name}
          executionId={executingTest.executionId}
          onComplete={handleTestExecutionComplete}
        />
      )}

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