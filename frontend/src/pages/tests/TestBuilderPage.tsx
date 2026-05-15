import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { AlertTriangle, Check, Pencil, Settings, X } from 'lucide-react'
import { TestBuilder } from '../../components/test-builder/TestBuilder'
import { TestConfigurationModal } from '../../components/test-builder/TestConfigurationModal'
import { LiveElementPicker } from '../../components/element-picker/LiveElementPicker' // NEW IMPORT
import { testsAPI, projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { ProjectElement } from '../../types/element.types'
import { TestStep, Test } from '../../types/test.types'
import { createLogger } from '../../lib/logger'

const logger = createLogger('TestBuilderPage')

interface ProjectUrl {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

interface Project {
  id: string
  name: string
  urls: ProjectUrl[]
}

export function TestBuilderPage() {
  const { projectId, testId } = useParams<{ projectId?: string; testId?: string }>()
  const navigate = useNavigate()
  const { showSuccess, showError } = useNotification()
  const [test, setTest] = useState<Test | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [testName, setTestName] = useState('')
  const [testDescription, setTestDescription] = useState('')
  const [selectedStartingUrl, setSelectedStartingUrl] = useState('')
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [configurationComplete, setConfigurationComplete] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [showLivePicker, setShowLivePicker] = useState(false) // NEW STATE

  // const [configModified, setConfigModified] = useState(false) // Currently unused

  useEffect(() => {
    loadData()
  }, [projectId, testId])

  // Check for unsaved changes in localStorage
  useEffect(() => {
    if (testId) {
      const checkUnsavedChanges = () => {
        const savedSteps = localStorage.getItem(`test-steps-${testId}`);
        if (savedSteps) {
          try {
            const parsedSteps = JSON.parse(savedSteps);
            const hasChanges = parsedSteps.length !== (test?.steps?.length || 0) || 
                              JSON.stringify(parsedSteps) !== JSON.stringify(test?.steps || []);
            setHasUnsavedChanges(hasChanges);
          } catch (e) {
            logger.warn('Failed to parse saved steps', e);
          }
        }
      };

      checkUnsavedChanges();
      
      // Check periodically for changes
      const interval = setInterval(checkUnsavedChanges, 1000);
      return () => clearInterval(interval);
    }
  }, [testId, test?.steps]);

  // Block navigation when there are unsaved changes
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  );

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const loadData = async () => {
    if (!projectId) {
      logger.error('No projectId provided');
      navigate('/projects');
      return;
    }

    try {
      // Load project
      const projectResponse = await projectsAPI.getById(projectId)
      setProject(projectResponse.data)

      // Set default starting URL to first project URL
      if (projectResponse.data.urls && projectResponse.data.urls.length > 0) {
        setSelectedStartingUrl(projectResponse.data.urls[0].url)
      }

      // Load test if editing
      if (testId) {
        const testResponse = await testsAPI.getById(testId)
        setTest(testResponse.data)
        setTestName(testResponse.data.name)
        setTestDescription(testResponse.data.description || '')
        setConfigurationComplete(true) // Skip modal for editing
      } else {
        // For new tests, show configuration modal first
        setTestName('New Test')
        setTestDescription('Created with Test Builder')
        setShowConfigModal(true)
      }
    } catch (error) {
      logger.error('Failed to load data', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (steps: TestStep[]) => {
    try {
      if (!selectedStartingUrl) {
        showError('Validation Error', 'Please select a starting URL for the test.')
        return
      }

      if (!testName.trim()) {
        showError('Validation Error', 'Please enter a test name.')
        return
      }

      if (!projectId) {
        showError('Error', 'Project ID is missing. Cannot save test.')
        navigate('/projects');
        return;
      }

      if (testId) {
        // Update existing test with full configuration
        await testsAPI.update(testId, {
          name: testName,
          description: testDescription,
          startingUrl: selectedStartingUrl,
          steps
        })
        showSuccess('Test Updated', `Successfully updated test "${testName}" with ${steps.length} step${steps.length !== 1 ? 's' : ''}`)
        
        // Clear localStorage and unsaved changes flag after successful save
        localStorage.removeItem(`test-steps-${testId}`);
        setHasUnsavedChanges(false);
      } else {
        // Create new test with steps
        await testsAPI.create({
          name: testName,
          description: testDescription,
          projectId: projectId, // Type guard above ensures this is defined
          startingUrl: selectedStartingUrl,
          steps
        })
        showSuccess('Test Created', `Successfully created test "${testName}" with ${steps.length} step${steps.length !== 1 ? 's' : ''}`)
        setHasUnsavedChanges(false);
      }
      navigate(`/projects/${projectId}/tests`)
    } catch (error) {
      logger.error('Failed to save test', error)
      showError('Save Failed', 'Failed to save test. Please check that all fields are valid.')
    }
  }

  const handleCancel = () => {
    navigate(`/projects/${projectId}/tests`)
  }

  const handleConfigurationSave = async (config: {
    name: string
    description: string
    startingUrl: string
  }) => {
    // Always update local state first so the builder header reflects the new
    // values immediately.
    setTestName(config.name)
    setTestDescription(config.description)
    setSelectedStartingUrl(config.startingUrl)
    setConfigurationComplete(true)
    setShowConfigModal(false)

    // For new tests the full save happens later via handleSave when the user
    // saves the test from the builder panel. For an EXISTING test we must
    // persist the config change to the backend now — otherwise refreshing
    // the page reverts the starting URL / name / description.
    if (!testId || !test) return

    const wasModified =
      config.name !== test.name ||
      config.description !== test.description ||
      config.startingUrl !== test.startingUrl
    if (!wasModified) return

    try {
      await testsAPI.update(testId, {
        name: config.name,
        description: config.description,
        startingUrl: config.startingUrl,
        // Preserve the steps that are currently persisted on the backend.
        // Unsaved step edits live in TestBuilderPanel/localStorage and are
        // applied via handleSave when the user clicks Save on the builder.
        steps: test.steps ?? [],
      })
      // Keep the in-memory `test` snapshot consistent with what was just saved
      // so subsequent comparisons / cancel paths see fresh values.
      setTest({
        ...test,
        name: config.name,
        description: config.description,
        startingUrl: config.startingUrl,
      })
      showSuccess('Configuration Saved', `Updated test configuration for "${config.name}"`)
    } catch (error) {
      logger.error('Failed to save configuration', error)
      showError('Save Failed', 'Failed to save test configuration. Please try again.')
    }
  }

  const handleConfigurationCancel = () => {
    setShowConfigModal(false)
    // Only navigate away if this is a new test (not editing existing)
    if (!testId) {
      navigate(`/projects/${projectId}/tests`)
    }
  }

  const handleEditConfiguration = () => {
    setShowConfigModal(true)
  }

  const handleStartNameEdit = () => {
    setEditedName(testName)
    setIsEditingName(true)
  }

  const handleSaveNameEdit = () => {
    if (editedName.trim() && editedName.trim() !== testName) {
      setTestName(editedName.trim())
      setHasUnsavedChanges(true)
    }
    setIsEditingName(false)
  }

  const handleCancelNameEdit = () => {
    setEditedName('')
    setIsEditingName(false)
  }

  const handleNameKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveNameEdit()
    } else if (e.key === 'Escape') {
      handleCancelNameEdit()
    }
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
    <>
      {/* Configuration Modal */}
      <TestConfigurationModal
        isOpen={showConfigModal}
        onClose={handleConfigurationCancel}
        onSave={handleConfigurationSave}
        project={project}
        initialConfig={{
          name: testName,
          description: testDescription,
          startingUrl: selectedStartingUrl
        }}
        isEdit={testId ? true : false}
      />

      {/* Main Test Builder Interface */}
      {configurationComplete && (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bone)',
          }}
        >
          {/* Minimal Header - Editable name + Edit Config */}
          <div
            style={{
              background: 'var(--paper)',
              borderBottom: '1px solid var(--hair)',
              padding: '8px 16px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div className="row" style={{ flex: 1, minWidth: 0, gap: 6 }}>
              {isEditingName ? (
                <>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={handleNameKeyPress}
                    onBlur={handleSaveNameEdit}
                    autoFocus
                    placeholder="Enter test name"
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '2px solid var(--moss)',
                      outline: 'none',
                      padding: '2px 0',
                    }}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleSaveNameEdit}
                    title="Save (Enter)"
                    style={{ color: 'var(--moss)' }}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleCancelNameEdit}
                    title="Cancel (Escape)"
                    style={{ color: 'var(--clay)' }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ink)',
                      letterSpacing: '-0.005em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {testName}
                  </span>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={handleStartNameEdit}
                    title="Click to edit test name"
                  >
                    <Pencil size={13} />
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleEditConfiguration}
              className="btn btn-outline btn-sm"
            >
              <Settings size={13} />
              <span>Edit Config</span>
            </button>
          </div>

          {/* Full-Height Test Builder */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TestBuilder
              onSave={handleSave}
              onCancel={handleCancel}
              initialSteps={test?.steps || []}
              projectId={projectId}
              testId={testId}
              startingUrl={selectedStartingUrl}
              setShowLivePicker={setShowLivePicker}
            />
          </div>
        </div>
      )}

      {/* Navigation Blocking Modal */}
      {blocker.state === "blocked" && (
        <div className="modal-backdrop" onClick={() => blocker.reset()}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="modal-title row" style={{ gap: 6 }}>
                  <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
                  <span>Unsaved Changes</span>
                </div>
                <div className="modal-sub">Save before you leave or discard your edits</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => blocker.reset()}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                You have unsaved changes that will be lost if you leave this page. Would you
                like to save your test before leaving?
              </p>
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginRight: 'auto' }}
                onClick={() => blocker.reset()}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  if (testId) {
                    localStorage.removeItem(`test-steps-${testId}`);
                  }
                  setHasUnsavedChanges(false);
                  blocker.proceed();
                }}
              >
                Discard & Leave
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  if (testId) {
                    const savedSteps = localStorage.getItem(`test-steps-${testId}`);
                    if (savedSteps) {
                      try {
                        const parsedSteps = JSON.parse(savedSteps);
                        await handleSave(parsedSteps);
                      } catch (e) {
                        logger.error('Failed to save before navigation', e);
                      }
                    }
                  }
                  blocker.proceed();
                }}
              >
                <Check size={13} />
                <span>Save & Leave</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Element Picker */}
      {projectId && (
        <LiveElementPicker
          isOpen={showLivePicker}
          projectId={projectId}
          onClose={() => setShowLivePicker(false)}
          onElementsSelected={(elements) => {
            showSuccess('Elements Selected', `${elements.length} element(s) added to library`);
            setShowLivePicker(false);
          }}
          onSelectElement={(selector, description) => {
            // Per-save callback — toast confirms persistence (the picker has
            // already saved server-side and dispatched the refresh event by
            // the time this fires). Do NOT close the modal here; the user
            // can keep picking more elements until they hit Done/Close.
            logger.debug('Selected Element', { selector, description });
            showSuccess('Element saved', `"${description}" added to library`);
          }}
          initialUrl={selectedStartingUrl}
        />
      )}
    </>
  )
}