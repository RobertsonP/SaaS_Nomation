import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Play, Plus, Trash2 } from 'lucide-react'
import { testsAPI, projectsAPI, testSuitesAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { useSuiteExecutionContext } from '../../contexts/SuiteExecutionContext'
import { Pill } from '../../components/ui/Pill'
import { createLogger } from '../../lib/logger'
import { RunModePickerModal } from '../../components/tests/RunModePickerModal'

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
  const { startTracking } = useSuiteExecutionContext()
  const navigate = useNavigate()
  
  const [testSuite, setTestSuite] = useState<TestSuite | null>(null)
  const [availableTests, setAvailableTests] = useState<Test[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddTestModal, setShowAddTestModal] = useState(false)
  const [showCreateTestModal, setShowCreateTestModal] = useState(false)
  const [showRunModePicker, setShowRunModePicker] = useState(false)
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

  const handleRunSuite = () => {
    if (!testSuite || testSuite.tests.length === 0) return
    setShowRunModePicker(true)
  }

  const handleRunSuiteWithMode = async (mode: 'headed' | 'headless') => {
    setShowRunModePicker(false)
    if (!testSuite) return

    try {
      showSuccess(
        'Suite Started',
        `Executing "${testSuite.name}" (${mode}) with ${testSuite.tests.length} tests. This may take a few minutes.`
      )

      // Backend now returns immediately and runs in background; queue events stream progress.
      const response = await testSuitesAPI.execute(testSuite.id, { headed: mode === 'headed' })
      const executionId =
        response?.data?.executionId ?? response?.data?.id ?? response?.data?.execution?.id;
      if (executionId) {
        startTracking({
          suiteId: testSuite.id,
          suiteName: testSuite.name,
          executionId,
          testsTotal: testSuite.tests.length,
        });
      }

      navigate(`/suites/${testSuite.id}/results`)
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
      <div className="content">
        <div className="row" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>
    )
  }

  if (!testSuite) {
    return (
      <div className="content">
        <div className="card">
          <div className="empty">
            <div className="empty-icon">!</div>
            <h3>Test suite not found</h3>
            <p>The suite you tried to open doesn't exist or you don't have access.</p>
            <Link to={`/projects/${projectId}/suites`} className="btn btn-outline">
              ← Back to Test Suites
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <Link
            to={`/projects/${projectId}/suites`}
            className="dim"
            style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
          >
            ← Back to Test Suites
          </Link>
          <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{testSuite.name}</h1>
            <Pill kind={testSuite.status === 'active' ? 'ok' : 'mute'}>{testSuite.status}</Pill>
          </div>
          {testSuite.description && <div className="sub">{testSuite.description}</div>}
          <div
            className="row"
            style={{ gap: 12, marginTop: 4, fontSize: 11.5, color: 'var(--ink-4)' }}
          >
            <span className="tabular">
              {testSuite.tests.length} test{testSuite.tests.length === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>Created {new Date(testSuite.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={handleRunSuite}
            disabled={testSuite.tests.length === 0}
            className="btn btn-primary"
            style={
              testSuite.tests.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined
            }
          >
            <Play size={13} />
            <span>Run All Tests</span>
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 6, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => setShowAddTestModal(true)}
          disabled={getUnassignedTests().length === 0}
          className="btn btn-outline btn-sm"
          style={
            getUnassignedTests().length === 0
              ? { opacity: 0.5, cursor: 'not-allowed' }
              : undefined
          }
        >
          <Plus size={13} />
          <span>Add Existing Tests</span>
        </button>
        <button
          type="button"
          onClick={() => setShowCreateTestModal(true)}
          className="btn btn-outline btn-sm"
        >
          <Plus size={13} />
          <span>Create New Test</span>
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Tests in suite ({testSuite.tests.length})</span>
        </div>
        {testSuite.tests.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <FlaskConical size={20} />
            </div>
            <h3>No tests in this suite yet</h3>
            <p>Add existing tests or create new ones to build out your suite.</p>
            <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowAddTestModal(true)}
                disabled={getUnassignedTests().length === 0}
                className="btn btn-outline"
                style={
                  getUnassignedTests().length === 0
                    ? { opacity: 0.5, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <Plus size={13} />
                <span>Add Existing</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateTestModal(true)}
                className="btn btn-primary"
              >
                <Plus size={13} />
                <span>Create New</span>
              </button>
            </div>
          </div>
        ) : (
          <div>
            {testSuite.tests.map((suiteTest, index) => {
              const test = isTestSuiteTest(suiteTest) ? suiteTest.test : suiteTest
              return (
                <div
                  key={test.id}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--hair)',
                  }}
                >
                  <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                        <span className="mono dim" style={{ fontSize: 11 }}>
                          #{index + 1}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--ink)',
                          }}
                        >
                          {test.name}
                        </span>
                        <Pill kind={test.status === 'active' ? 'ok' : 'mute'}>{test.status}</Pill>
                      </div>
                      {test.description && (
                        <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
                          {test.description}
                        </div>
                      )}
                      <div
                        className="row"
                        style={{ gap: 12, marginTop: 4, fontSize: 11, color: 'var(--ink-4)' }}
                      >
                        <span className="tabular">
                          {test.steps?.length || 0} step{(test.steps?.length || 0) === 1 ? '' : 's'}
                        </span>
                        <span>·</span>
                        <span>Created {new Date(test.createdAt).toLocaleDateString()}</span>
                        {test.startingUrl && (
                          <>
                            <span>·</span>
                            <span
                              className="mono"
                              style={{
                                fontSize: 10.5,
                                color: 'var(--slate)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 280,
                              }}
                              title={test.startingUrl}
                            >
                              {test.startingUrl}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                      <Link
                        to={`/projects/${projectId}/tests/${test.id}/edit`}
                        className="btn btn-ghost btn-sm"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveTest(test.id)}
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--clay)' }}
                        title="Remove from suite"
                      >
                        <Trash2 size={13} />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-hidden">
            <div className="p-6 border-b dark:border-gray-700">
              <h3 className="text-lg font-semibold">Add Existing Tests to Suite</h3>
            </div>
            <div className="p-6 overflow-y-auto max-h-64">
              {getUnassignedTests().length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                  All available tests are already in this suite.
                </p>
              ) : (
                <div className="space-y-3">
                  {getUnassignedTests().map(test => (
                    <label key={test.id} className="flex items-center p-3 border dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
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
                          <div className="text-sm text-gray-500 dark:text-gray-400">{test.description}</div>
                        )}
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {test.steps.length} steps • {new Date(test.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex space-x-3">
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
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New Test</h3>
              <form onSubmit={handleCreateNewTest}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Test Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newTest.name}
                      onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="Enter test name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTest.description}
                      onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="Enter test description"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Starting URL
                    </label>
                    <input
                      type="url"
                      required
                      value={newTest.startingUrl}
                      onChange={(e) => setNewTest({ ...newTest, startingUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <div className="flex space-x-3 mt-6">
                  <button
                    type="submit"
                    className="flex-1 text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create & Add to Suite
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateTestModal(false)
                      setNewTest({ name: '', description: '', startingUrl: '' })
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <RunModePickerModal
        open={showRunModePicker}
        testName={testSuite?.name ? `Run All Tests — ${testSuite.name}` : 'Run All Tests'}
        onCancel={() => setShowRunModePicker(false)}
        onPick={handleRunSuiteWithMode}
      />
    </div>
  )
}