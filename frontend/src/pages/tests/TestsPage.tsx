import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { testsAPI, projectsAPI } from '../../lib/api'
import { TestExecutionModal } from '../../components/execution/TestExecutionModal'
import { RunModePickerModal } from '../../components/tests/RunModePickerModal'
import { executionAPI } from '../../lib/api'
import { useTestExecution } from '../../hooks/useTestExecution'
import { useNotification } from '../../contexts/NotificationContext'
import { TestStep } from '../../types/test.types'
import { createLogger } from '../../lib/logger'
import { Eye, FlaskConical, Loader2, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { Pill } from '../../components/ui/Pill'

const logger = createLogger('TestsPage')

// Feature flag: AI test generation — hidden until Anthropic API billing is funded (pre-launch).
const AI_TEST_GEN_ENABLED = false;

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
  const { showSuccess, showError, showWarning } = useNotification()
  const [tests, setTests] = useState<Test[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [executingTest, setExecutingTest] = useState<{
    id: string
    name: string
    executionId: string
  } | null>(null)
  const [runModePickerTest, setRunModePickerTest] = useState<{id: string; name: string} | null>(null)
  const [newTest, setNewTest] = useState({
    name: '',
    description: '',
    startingUrl: ''
  })

  // Hook for queue-based execution
  const { runTest, executionState, isExecuting } = useTestExecution()
  const [currentlyRunningTestId, setCurrentlyRunningTestId] = useState<string | null>(null)
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)

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
      showWarning('Test Running', 'A test is already running. Please wait.')
      return
    }

    setCurrentlyRunningTestId(testId)
    
    // Use the queue hook
    runTest(testId, (result) => {
      logger.info('Test execution completed', result)
      setCurrentlyRunningTestId(null)
      // Reload tests to show status update
      loadProjectAndTests()
      if (result.success) {
        showSuccess('Test Passed', 'Test execution completed successfully.')
      } else {
        showError('Test Failed', 'Test execution completed with failures.')
      }
    })
  }

  const handleOpenRunPicker = (testId: string, testName: string) => {
    setRunModePickerTest({ id: testId, name: testName })
  }

  const handlePickRunMode = async (mode: 'headed' | 'headless') => {
    if (!runModePickerTest) return
    const picked = runModePickerTest
    setRunModePickerTest(null)
    try {
      await executionAPI.runLive(picked.id, { headed: mode === 'headed' })
      if (mode === 'headed') {
        showSuccess(
          'Test launched',
          `"${picked.name}" is running in a real browser window. Check the host display.`,
        )
      } else {
        showSuccess(
          'Test queued',
          `"${picked.name}" is running in the background. Open View Results when it finishes to watch the recording.`,
        )
      }
      loadProjectAndTests()
    } catch (err: any) {
      logger.error('Failed to launch test', err)
      showError('Run failed', err?.response?.data?.message || err?.message || 'Could not launch the test.')
    }
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
      showError('Delete Failed', 'Failed to delete test. Please try again.')
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


  if (loading) {
    return (
      <div className="content">
        <div className="row" style={{ minHeight: '40vh', justifyContent: 'center' }}>
          <div className="skel" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        </div>
      </div>
    )
  }

  return (
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
          <h1>Tests</h1>
          <div className="sub">
            {project?.name}
            {project?.description ? ` · ${project.description}` : ''}
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {AI_TEST_GEN_ENABLED && (
            <button
              type="button"
              onClick={async () => {
                if (!projectId) return;
                setIsGeneratingAI(true);
                try {
                  const res = await projectsAPI.generateTests(projectId);
                  const total = res?.summary?.total || res?.tests?.length || 0;
                  showSuccess('Tests Generated', `${total} test scenarios created as drafts`);
                  loadProjectAndTests();
                } catch (err: any) {
                  const msg = err?.response?.data?.message || err?.message || 'Unknown error';
                  showError('Generation Failed', msg);
                } finally {
                  setIsGeneratingAI(false);
                }
              }}
              disabled={isGeneratingAI}
              className="btn btn-outline"
              style={{ color: 'var(--amber)', borderColor: 'var(--amber-edge)' }}
            >
              {isGeneratingAI ? 'Generating…' : 'AI Generate Tests'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            <Plus size={13} />
            <span>Create Test</span>
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="card-title">Create New Test</span>
          </div>
          <form onSubmit={handleCreateTest} className="card-pad col" style={{ gap: 12 }}>
            <div className="field">
              <label>Test Name</label>
              <input
                type="text"
                required
                value={newTest.name}
                onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                placeholder="e.g. Checkout — credit card"
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                value={newTest.description}
                onChange={(e) => setNewTest({ ...newTest, description: e.target.value })}
                placeholder="Short description of what this test verifies"
                rows={3}
              />
            </div>
            <div className="field">
              <label>Starting URL</label>
              <input
                type="url"
                required
                value={newTest.startingUrl}
                onChange={(e) => setNewTest({ ...newTest, startingUrl: e.target.value })}
                placeholder="https://example.com"
                className="mono"
              />
              <span className="hint">The page Playwright navigates to before running the steps.</span>
            </div>
            <div className="row" style={{ gap: 6, paddingTop: 4 }}>
              <button type="submit" className="btn btn-primary">
                <Plus size={13} />
                <span>Create Test</span>
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
        {tests.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <FlaskConical size={20} />
            </div>
            <h3>No tests yet</h3>
            <p>Create your first test to start automating verification for this project.</p>
            <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
              <Plus size={13} />
              <span>Create Test</span>
            </button>
          </div>
        ) : (
          <div>
            {tests.map((test) => {
              const running = isExecuting && currentlyRunningTestId === test.id;
              return (
                <div
                  key={test.id}
                  className="row"
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--hair)',
                    gap: 12,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          letterSpacing: '-0.005em',
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
                      <span className="tabular">{test.steps.length} step{test.steps.length === 1 ? '' : 's'}</span>
                      <span>·</span>
                      <span>Created {new Date(test.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 4, flexShrink: 0 }}>
                    <Link
                      to={`/projects/${projectId}/tests/${test.id}/edit`}
                      className="btn btn-ghost btn-sm"
                      title="Edit test"
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleOpenRunPicker(test.id, test.name)}
                      disabled={test.steps.length === 0 || running}
                      className="btn btn-outline btn-sm"
                      title={
                        test.steps.length === 0
                          ? 'No steps yet — open the Test Builder to add some'
                          : 'Run with live progress (choose headed or headless)'
                      }
                      style={
                        test.steps.length === 0
                          ? { opacity: 0.5, cursor: 'not-allowed' }
                          : undefined
                      }
                    >
                      {running ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>
                            {executionState?.status === 'waiting'
                              ? `#${executionState.position}`
                              : 'Running'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Play size={13} />
                          <span>Run</span>
                        </>
                      )}
                    </button>
                    <Link
                      to={`/tests/${test.id}/results`}
                      className="btn btn-ghost btn-sm"
                      title="View execution history"
                    >
                      <Eye size={13} />
                      <span>Results</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDeleteTest(test.id, test.name)}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--clay)' }}
                      title="Delete test"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
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

      {/* Run mode picker — Headed vs Headless */}
      <RunModePickerModal
        open={!!runModePickerTest}
        testName={runModePickerTest?.name ?? ''}
        onCancel={() => setRunModePickerTest(null)}
        onPick={handlePickRunMode}
      />
    </div>
  )
}