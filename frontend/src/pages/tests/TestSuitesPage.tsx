import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Eye, Layers, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { testsAPI, projectsAPI, testSuitesAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { RunModePickerModal } from '../../components/tests/RunModePickerModal'
import { Pill } from '../../components/ui/Pill'
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

      <div className="content">
        <div className="page-head">
          <div>
            <Link
              to={`/projects/${projectId}`}
              className="dim"
              style={{ fontSize: 11.5, textDecoration: 'none', display: 'inline-block', marginBottom: 4 }}
            >
              ← Back to project
            </Link>
            <h1>Test Suites</h1>
            <div className="sub">
              {project?.name}
              {project?.description ? ` · ${project.description}` : ''}
            </div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            <Link
              to={`/projects/${projectId}/tests`}
              className="btn btn-outline btn-sm"
            >
              Manage individual tests
            </Link>
            <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
              <Plus size={13} />
              <span>Create suite</span>
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <span className="card-title">Create New Test Suite</span>
            </div>
            <form onSubmit={handleCreateSuite} className="card-pad col" style={{ gap: 12 }}>
              <div className="field">
                <label>Suite Name</label>
                <input
                  type="text"
                  required
                  value={newSuite.name}
                  onChange={(e) => setNewSuite({ ...newSuite, name: e.target.value })}
                  placeholder="e.g. Login flow, Checkout regression"
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  value={newSuite.description}
                  onChange={(e) => setNewSuite({ ...newSuite, description: e.target.value })}
                  placeholder="Describe what this suite covers"
                  rows={3}
                />
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button type="submit" className="btn btn-primary">
                  <Plus size={13} />
                  <span>Create Suite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="card">
          {testSuites.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">
                <Layers size={20} />
              </div>
              <h3>No test suites yet</h3>
              <p>Suites group related tests so you can run them together (smoke, regression, etc.).</p>
              <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
                  <Plus size={13} />
                  <span>Create your first suite</span>
                </button>
                <Link to={`/projects/${projectId}/tests`} className="btn btn-ghost">
                  Manage individual tests
                </Link>
              </div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Suite</th>
                  <th className="num">Tests</th>
                  <th>Status</th>
                  <th className="num">Created</th>
                  <th className="num">Last run</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {testSuites.map((suite) => (
                  <tr key={suite.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{suite.name}</div>
                      {suite.description && (
                        <div className="dim" style={{ fontSize: 10.5 }}>
                          {suite.description}
                        </div>
                      )}
                      {suite.tests.length > 0 && (
                        <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {suite.tests.slice(0, 5).map((suiteTest) => {
                            const test = isTestSuiteTest(suiteTest) ? suiteTest.test : suiteTest;
                            return (
                              <Pill key={test.id} kind="mute" dot={false}>
                                {test.name}
                              </Pill>
                            );
                          })}
                          {suite.tests.length > 5 && (
                            <Pill kind="mute" dot={false}>
                              +{suite.tests.length - 5}
                            </Pill>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="num">{suite.tests.length}</td>
                    <td>
                      <Pill kind={suite.status === 'active' ? 'ok' : 'mute'} dot={false}>
                        {suite.status}
                      </Pill>
                    </td>
                    <td className="num dim">
                      {new Date(suite.createdAt).toLocaleDateString()}
                    </td>
                    <td className="num dim">
                      {suite.lastRun ? new Date(suite.lastRun).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                        <button
                          type="button"
                          onClick={() => handleRunSuite(suite.id)}
                          disabled={suite.tests.length === 0}
                          className="btn btn-ghost btn-icon"
                          title="Run all tests"
                          style={
                            suite.tests.length === 0
                              ? { opacity: 0.5, cursor: 'not-allowed' }
                              : undefined
                          }
                        >
                          <Play size={13} />
                        </button>
                        <Link
                          to={`/projects/${projectId}/suites/${suite.id}`}
                          className="btn btn-ghost btn-icon"
                          title="Manage suite"
                        >
                          <Pencil size={13} />
                        </Link>
                        <Link
                          to={`/suites/${suite.id}/results`}
                          className="btn btn-ghost btn-icon"
                          title="Results"
                        >
                          <Eye size={13} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteSuite(suite.id, suite.name)}
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--clay)' }}
                          title="Delete suite"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}