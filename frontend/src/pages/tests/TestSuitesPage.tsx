import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { testsAPI, projectsAPI, testSuitesAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { RunModePickerModal } from '../../components/tests/RunModePickerModal'
import { TestStep } from '../../types/test.types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('TestSuitesPage')

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
  const [pickerForSuite, setPickerForSuite] = useState<{ id: string; name: string } | null>(null)
  const navigate = useNavigate()

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

  const handleRunSuite = (suiteId: string) => {
    const suite = testSuites.find(s => s.id === suiteId)
    if (!suite) {
      showError('Suite Not Found', 'Test suite not found')
      return
    }
    if (suite.tests.length === 0) {
      showError('No Tests', 'Cannot run empty test suite. Please add tests first.')
      return
    }
    setPickerForSuite({ id: suiteId, name: suite.name })
  }

  const handleRunSuiteWithMode = async (mode: 'headed' | 'headless') => {
    if (!pickerForSuite) return
    const { id: suiteId, name } = pickerForSuite
    setPickerForSuite(null)

    try {
      await testSuitesAPI.execute(suiteId, { headed: mode === 'headed' })
      showSuccess('Suite Started', `Executing "${name}" (${mode}). Streaming progress on the results page.`)
      navigate(`/suites/${suiteId}/results`)
    } catch (error) {
      logger.error('Failed to start test suite execution:', error)
      showError('Execution Failed', 'Failed to start test suite execution')
    }
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
      <RunModePickerModal
        open={!!pickerForSuite}
        testName={pickerForSuite ? `Run All Tests — ${pickerForSuite.name}` : 'Run All Tests'}
        onCancel={() => setPickerForSuite(null)}
        onPick={handleRunSuiteWithMode}
      />


    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to="/projects" className="text-blue-600 hover:text-blue-800">
            ← Back to Projects
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{project?.name}</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{project?.description}</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Test Suites</h2>
        <div className="flex items-center gap-3">
          <Link
            to={`/projects/${projectId}/tests`}
            className="text-sm font-medium text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Manage Individual Tests
          </Link>
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            Create Test Suite
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Test Suite</h3>
          <form onSubmit={handleCreateSuite}>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Suite Name
                </label>
                <input
                  type="text"
                  required
                  value={newSuite.name}
                  onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="e.g., Login Flow Tests, Checkout Process Tests"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newSuite.description}
                  onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Describe what this test suite covers..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Create Suite
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-sm font-medium text-gray-700 dark:text-gray-300 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700">
        {testSuites.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-gray-500 dark:text-gray-400 mb-4">No test suites created yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
              Test suites help you organize and run related tests together. 
              Create your first suite to get started!
            </p>
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Create Your First Test Suite
              </button>
              <div className="text-sm text-gray-500 dark:text-gray-400">
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
          <div className="divide-y dark:divide-gray-700">
            {testSuites.map((suite) => (
              <div key={suite.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{suite.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        suite.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {suite.status}
                      </span>
                    </div>
                    {suite.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3">{suite.description}</p>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>📋 {suite.tests.length} tests</span>
                      <span>📅 Created {new Date(suite.createdAt).toLocaleDateString()}</span>
                      {suite.lastRun && (
                        <span>🚀 Last run {new Date(suite.lastRun).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/projects/${projectId}/suites/${suite.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      Manage
                    </Link>
                    <button
                      onClick={() => handleRunSuite(suite.id)}
                      disabled={suite.tests.length === 0}
                      className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                        suite.tests.length === 0
                          ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'text-green-600 hover:text-green-800 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                    >
                      Run Suite
                    </button>
                    <Link
                      to={`/suites/${suite.id}/results`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 px-2 py-1 rounded transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      Results
                    </Link>
                    <button
                      onClick={() => handleDeleteSuite(suite.id, suite.name)}
                      className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Delete suite"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                {/* Quick test preview */}
                {suite.tests.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tests in this suite:</div>
                    <div className="flex flex-wrap gap-2">
                      {suite.tests.slice(0, 5).map(suiteTest => {
                        // Handle nested structure from backend
                        const test = isTestSuiteTest(suiteTest) ? suiteTest.test : suiteTest
                        return (
                          <span
                            key={test.id}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                          >
                            {test.name}
                          </span>
                        )
                      })}
                      {suite.tests.length > 5 && (
                        <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-xs rounded">
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