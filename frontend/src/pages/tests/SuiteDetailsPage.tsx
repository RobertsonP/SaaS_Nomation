import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { testsAPI, projectsAPI, testSuitesAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { createLogger } from '../../lib/logger'

const logger = createLogger('SuiteDetailsPage')

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
  steps: any[]
  createdAt: string
  startingUrl?: string
}

interface Project {
  id: string
  name: string
  description?: string
}

export function SuiteDetailsPage() {
  const { projectId, suiteId } = useParams<{ projectId: string; suiteId: string }>()
  const { showSuccess, showError } = useNotification()
  
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null)
  const [availableTests, setAvailableTests] = useState<Test[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddTestModal, setShowAddTestModal] = useState(false)
  const [showCreateTestModal, setShowCreateTestModal] = useState(false)
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [newTest, setNewTest] = useState({
    name: '',
    description: '',
    startingUrl: ''
  })

  useEffect(() => {
    if (projectId && suiteId) {
      loadData()
    }
  }, [projectId, suiteId])

  const loadData = async () => {
    try {
      const [projectResponse, testsResponse, suiteResponse] = await Promise.all([
        projectsAPI.getById(projectId!),
        testsAPI.getByProject(projectId!),
        testSuitesAPI.getById(suiteId!)
      ])
      setProject(projectResponse.data)
      setAvailableTests(testsResponse.data)
      setTestSuite(suiteResponse.data)
      
    } catch (error) {
      logger.error('Failed to load data', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExistingTests = async () => {
    if (!testSuite || selectedTests.length === 0) return
    
    try {
      const response = await testSuitesAPI.addTests(testSuite.id, selectedTests)
      setTestSuite(response.data)
      setSelectedTests([])
      setShowAddTestModal(false)
      showSuccess('Tests Added', `${selectedTests.length} test(s) added to suite`)
    } catch (error) {
      logger.error('Failed to add tests to suite', error)
      showError('Add Tests Failed', 'Failed to add tests to suite')
    }
  }

  const handleCreateNewTest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!projectId || !testSuite) {
      showError('Error', 'Project or test suite not found')
      return
    }

    try {
      // Step 1: Create the test
      const createdTest = await testsAPI.create({
        ...newTest,
        projectId: projectId,
        steps: []
      })

      logger.debug('Test created', createdTest.data.id)

      // Step 2: Add test to suite (THIS WAS MISSING!)
      await testSuitesAPI.addTests(testSuite.id, [createdTest.data.id])

      logger.debug('Test added to suite')

      // Step 3: Reload suite data (will now include the new test)
      await loadData()

      // Step 4: Close modal and reset form
      setShowCreateTestModal(false)
      setNewTest({
        name: '',
        description: '',
        startingUrl: ''
      })

      showSuccess('Test Created', `Test "${newTest.name}" created and added to suite successfully`)

    } catch (error: any) {
      logger.error('Failed to create test', error)
      showError('Failed to Create Test', error.response?.data?.message || 'An error occurred')
    }
  }

  const handleRemoveTest = async (testId: string) => {
    if (!testSuite) return
    
    try {
      const response = await testSuitesAPI.removeTest(testSuite.id, testId)
      setTestSuite(response.data)
      showSuccess('Test Removed', 'Test removed from suite')
    } catch (error) {
      logger.error('Failed to remove test from suite', error)
      showError('Remove Failed', 'Failed to remove test from suite')
    }
  }

  const handleRunSuite = async () => {
    if (!testSuite) return
    
    try {
      showSuccess('Suite Started', `Executing "${testSuite.name}" with ${testSuite.tests.length} tests. This may take a few minutes.`)
      
      // Start execution (async - don't wait for completion)
      testSuitesAPI.execute(testSuite.id)
        .then(() => {
          showSuccess('Suite Completed', `Test suite "${testSuite.name}" execution completed!`)
        })
        .catch((error) => {
          logger.error('Suite execution failed', error)
          showError('Execution Failed', `Test suite "${testSuite.name}" execution failed`)
        })
    } catch (error) {
      logger.error('Failed to start suite execution', error)
      showError('Execution Failed', 'Failed to start suite execution')
    }
  }

  // Type guard to check if item is TestSuiteTest
  const isTestSuiteTest = (item: TestSuiteTest | Test): item is TestSuiteTest => {
    return 'test' in item && 'suiteId' in item
  }

  const getUnassignedTests = () => {
    if (!testSuite) return availableTests
    // Handle nested structure from backend: tests[].test.id
    const suiteTestIds = testSuite.tests.map(suiteTest => 
      isTestSuiteTest(suiteTest) ? suiteTest.test.id : suiteTest.id
    )
    return availableTests.filter(test => !suiteTestIds.includes(test.id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test suite...</div>
      </div>
    )
  }

  if (!testSuite) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-lg">Test suite not found</div>
          <Link 
            to={`/projects/${projectId}/suites`}
            className="text-blue-600 hover:text-blue-800 mt-4 inline-block"
          >
            ← Back to Test Suites
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link 
            to={`/projects/${projectId}/suites`} 
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Test Suites
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{testSuite.name}</h1>
            {testSuite.description && (
              <p className="text-gray-600 mt-2">{testSuite.description}</p>
            )}
            <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
              <span>📋 {testSuite.tests.length} tests</span>
              <span>📅 Created {new Date(testSuite.createdAt).toLocaleDateString()}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                testSuite.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {testSuite.status}
              </span>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRunSuite}
              disabled={testSuite.tests.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              ▶️ Run All Tests
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setShowAddTestModal(true)}
          disabled={getUnassignedTests().length === 0}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          ➕ Add Existing Tests
        </button>
        <button
          onClick={() => setShowCreateTestModal(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
        >
          🆕 Create New Test
        </button>
      </div>

      {/* Tests in Suite */}
      <div className="bg-white rounded-lg shadow border">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Tests in Suite ({testSuite.tests.length})</h2>
        </div>
        
        {testSuite.tests.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-gray-500 mb-4">No tests in this suite yet</p>
            <p className="text-sm text-gray-400 mb-6">
              Add existing tests or create new ones to build your test suite.
            </p>
            <div className="space-x-4">
              <button
                onClick={() => setShowAddTestModal(true)}
                disabled={getUnassignedTests().length === 0}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                ➕ Add Existing Tests
              </button>
              <button
                onClick={() => setShowCreateTestModal(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                🆕 Create New Test
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {testSuite.tests.map((suiteTest, index) => {
              // Handle both nested structure from backend and direct test object
              const test = isTestSuiteTest(suiteTest) ? suiteTest.test : suiteTest
              return (
                <div key={test.id} className="p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm text-gray-500 font-mono">#{index + 1}</span>
                        <h3 className="text-lg font-medium">{test.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          test.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {test.status}
                        </span>
                      </div>
                      {test.description && (
                        <p className="text-gray-600 mb-2">{test.description}</p>
                      )}
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>⚡ {test.steps?.length || 0} steps</span>
                        <span>📅 {new Date(test.createdAt).toLocaleDateString()}</span>
                        {test.startingUrl && (
                          <span className="truncate max-w-xs">🌐 {test.startingUrl}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Link
                        to={`/projects/${projectId}/tests/${test.id}/edit`}
                        className="text-blue-600 hover:text-blue-800 text-sm px-3 py-1 border border-blue-200 rounded hover:bg-blue-50"
                      >
                        ✏️ Edit
                      </Link>
                      <button
                        onClick={() => handleRemoveTest(test.id)}
                        className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-200 rounded hover:bg-red-50"
                      >
                        ❌ Remove
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Existing Tests Modal */}
      {showAddTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">Add Existing Tests to Suite</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-64">
              {getUnassignedTests().length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  All available tests are already in this suite.
                </p>
              ) : (
                <div className="space-y-3">
                  {getUnassignedTests().map(test => (
                    <label key={test.id} className="flex items-center p-3 border rounded hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTests([...selectedTests, test.id])
                          } else {
                            setSelectedTests(selectedTests.filter(id => id !== test.id))
                          }
                        }}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{test.name}</div>
                        {test.description && (
                          <div className="text-sm text-gray-500">{test.description}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          {test.steps.length} steps • {new Date(test.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t flex space-x-3">
              <button
                onClick={handleAddExistingTests}
                disabled={selectedTests.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                Add {selectedTests.length} Test{selectedTests.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={() => {
                  setShowAddTestModal(false)
                  setSelectedTests([])
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Test Modal */}
      {showCreateTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Test</h3>
              <form onSubmit={handleCreateNewTest}>
                <div className="space-y-4">
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
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                  >
                    Create & Add to Suite
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTestModal(false)
                      setNewTest({ name: '', description: '', startingUrl: '' })
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}