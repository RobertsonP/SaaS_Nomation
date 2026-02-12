import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { testsAPI, projectsAPI, testSuitesAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { SuiteExecutionModal } from '../../components/test-suites/SuiteExecutionModal'
import { TestStep } from '../../types/test.types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('TestSuitesPage')

// Suite execution progress type from modal callback
interface SuiteExecutionProgress {
  totalTests: number;
  tests: Array<{ status: string }>;
}

interface TestSuite {
  id: string
  name: string
  description?: string
  tests: Array<TestSuiteTest | Test>
  createdAt: string
  lastRun?: string
  status: 'active' | 'draft'
}

interface TestSuiteTest {
  id: string
  suiteId: string
  testId: string
  order: number
  createdAt: string
  test: Test
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

export function TestSuitesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { showSuccess, showError } = useNotification()
  
  // Type guard to check if item is TestSuiteTest
  const isTestSuiteTest = (item: TestSuiteTest | Test): item is TestSuiteTest => {
    return 'test' in item && 'suiteId' in item
  }
  
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newSuite, setNewSuite] = useState({
    name: '',
    description: ''
  })
  const [executingSuite, setExecutingSuite] = useState<{
    id: string;
    name: string;
    totalTests: number;
    executionId: string;
  } | null>(null)

  useEffect(() => {
    if (projectId) {
      loadProjectAndData()
    }
  }, [projectId])

  const loadProjectAndData = async () => {
    try {
      const [projectResponse, suitesResponse] = await Promise.all([
        projectsAPI.getById(projectId!),
        testSuitesAPI.getByProject(projectId!)
      ])
      setProject(projectResponse.data)
      setTestSuites(suitesResponse.data)
      
    } catch (error) {
      logger.error('Failed to load project and data:', error)
      showError('Loading Failed', 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuite = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await testSuitesAPI.create({
        name: newSuite.name,
        description: newSuite.description,
        projectId: projectId!
      })
      
      setTestSuites([...testSuites, response.data])
      setNewSuite({ name: '', description: '' })
      setShowCreateForm(false)
      showSuccess('Suite Created', `Test suite "${newSuite.name}" created successfully`)
      
    } catch (error) {
      logger.error('Failed to create test suite:', error)
      showError('Creation Failed', 'Failed to create test suite')
    }
  }

  const handleRunSuite = async (suiteId: string) => {
    try {
      const suite = testSuites.find(s => s.id === suiteId)
      if (!suite) {
        showError('Suite Not Found', 'Test suite not found')
        return
      }

      if (suite.tests.length === 0) {
        showError('No Tests', 'Cannot run empty test suite. Please add tests first.')
        return
      }

      // Start actual execution and get execution ID
      const executionResponse = await testSuitesAPI.execute(suiteId)
      const executionId = executionResponse.data.id

      logger.info(`Suite execution started with ID: ${executionId}`)

      // Show execution modal with real execution ID
      setExecutingSuite({
        id: suiteId,
        name: suite.name,
        totalTests: suite.tests.length,
        executionId: executionId
      })

    } catch (error) {
      logger.error('Failed to start test suite execution:', error)
      showError('Execution Failed', 'Failed to start test suite execution')
      setExecutingSuite(null)
    }
  }

  const handleExecutionComplete = (results: SuiteExecutionProgress) => {
    logger.info('Suite execution completed:', results)
    showSuccess('Suite Completed', `Test suite execution completed! ${results.tests.filter((t) => t.status === 'passed').length}/${results.totalTests} tests passed.`)
    // Refresh suite data to show latest execution
    loadProjectAndData()
  }

  const handleCloseExecution = () => {
    setExecutingSuite(null)
  }

  const handleDeleteSuite = async (suiteId: string, suiteName: string) => {
    if (!window.confirm(`Delete suite "${suiteName}"? This will remove all execution history. This action cannot be undone.`)) {
      return
    }

    try {
      await testSuitesAPI.delete(suiteId)
      setTestSuites(testSuites.filter(s => s.id !== suiteId))
      showSuccess('Suite Deleted', `Test suite "${suiteName}" has been deleted`)
    } catch (error) {
      logger.error('Failed to delete test suite:', error)
      showError('Deletion Failed', 'Failed to delete test suite')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test suites...</div>
      </div>
    )
  }

  return (
    <>
      {/* Suite Execution Modal */}
      {executingSuite && (
        <SuiteExecutionModal
          isOpen={!!executingSuite}
          onClose={handleCloseExecution}
          suiteId={executingSuite.id}
          suiteName={executingSuite.name}
          totalTests={executingSuite.totalTests}
          executionId={executingSuite.executionId}
          onComplete={handleExecutionComplete}
        />
      )}
      
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to="/projects" className="text-blue-600 hover:text-blue-800">
            ← Back to Projects
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
        <p className="text-gray-600 mt-2">{project?.description}</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Test Suites</h2>
        <div className="flex space-x-4">
          <Link
            to={`/projects/${projectId}/tests`}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            📋 Manage Individual Tests
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            ➕ Create Test Suite
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Test Suite</h3>
          <form onSubmit={handleCreateSuite}>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suite Name
                </label>
                <input
                  type="text"
                  required
                  value={newSuite.name}
                  onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Login Flow Tests, Checkout Process Tests"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newSuite.description}
                  onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe what this test suite covers..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Suite
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

      <div className="bg-white rounded-lg shadow border">
        {testSuites.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-gray-500 mb-4">No test suites created yet</p>
            <p className="text-sm text-gray-400 mb-6">
              Test suites help you organize and run related tests together. 
              Create your first suite to get started!
            </p>
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                ➕ Create Your First Test Suite
              </button>
              <div className="text-sm text-gray-500">
                Or{' '}
                <Link 
                  to={`/projects/${projectId}/tests`}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  manage individual tests
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {testSuites.map((suite) => (
              <div key={suite.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{suite.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        suite.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {suite.status}
                      </span>
                    </div>
                    {suite.description && (
                      <p className="text-gray-600 mb-3">{suite.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>📋 {suite.tests.length} tests</span>
                      <span>📅 Created {new Date(suite.createdAt).toLocaleDateString()}</span>
                      {suite.lastRun && (
                        <span>🚀 Last run {new Date(suite.lastRun).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/projects/${projectId}/suites/${suite.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      📝 Manage
                    </Link>
                    <button
                      onClick={() => handleRunSuite(suite.id)}
                      disabled={suite.tests.length === 0}
                      className="text-green-600 hover:text-green-800 text-sm px-3 py-1 border border-green-200 rounded hover:bg-green-50 disabled:text-gray-400 disabled:border-gray-200"
                    >
                      ▶️ Run Suite
                    </button>
                    <Link
                      to={`/suites/${suite.id}/results`}
                      className="text-purple-600 hover:text-purple-800 text-sm px-3 py-1 border border-purple-200 rounded hover:bg-purple-50"
                    >
                      📊 Results
                    </Link>
                    <button
                      onClick={() => handleDeleteSuite(suite.id, suite.name)}
                      className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                      title="Delete suite"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
                
                {/* Quick test preview */}
                {suite.tests.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-2">Tests in this suite:</div>
                    <div className="flex flex-wrap gap-2">
                      {suite.tests.slice(0, 5).map(suiteTest => {
                        // Handle nested structure from backend
                        const test = isTestSuiteTest(suiteTest) ? suiteTest.test : suiteTest
                        return (
                          <span
                            key={test.id}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {test.name}
                          </span>
                        )
                      })}
                      {suite.tests.length > 5 && (
                        <span className="px-2 py-1 bg-gray-200 text-gray-500 text-xs rounded">
                          +{suite.tests.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  )
}