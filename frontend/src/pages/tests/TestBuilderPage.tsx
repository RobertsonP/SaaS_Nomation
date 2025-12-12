import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { TestBuilder } from '../../components/test-builder/TestBuilder'
import { TestConfigurationModal } from '../../components/test-builder/TestConfigurationModal'
import { testsAPI, projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'
import { ProjectElement } from '../../types/element.types'

interface TestStep {
  id: string
  type: 'click' | 'type' | 'wait' | 'assert' | 'hover' | 'scroll' | 'select' | 'clear' | 'doubleclick' | 'rightclick' | 'press' | 'upload' | 'check' | 'uncheck'
  selector: string
  value?: string
  description: string
}

interface Test {
  id: string
  name: string
  description?: string
  steps: TestStep[]
}

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
  const { projectId, testId } = useParams<{ projectId: string; testId?: string }>()
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
            console.warn('Failed to parse saved steps:', e);
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
    try {
      // Load project
      const projectResponse = await projectsAPI.getById(projectId!)
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
      console.error('Failed to load data:', error)
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
          projectId: projectId!,
          startingUrl: selectedStartingUrl,
          steps
        })
        showSuccess('Test Created', `Successfully created test "${testName}" with ${steps.length} step${steps.length !== 1 ? 's' : ''}`)
        setHasUnsavedChanges(false);
      }
      navigate(`/projects/${projectId}/tests`)
    } catch (error) {
      console.error('Failed to save test:', error)
      showError('Save Failed', 'Failed to save test. Please check that all fields are valid.')
    }
  }

  const handleCancel = () => {
    navigate(`/projects/${projectId}/tests`)
  }

  const handleConfigurationSave = (config: {
    name: string
    description: string
    startingUrl: string
  }) => {
    // Check if configuration was actually modified
    const wasModified = testId && (
      config.name !== test?.name ||
      config.description !== test?.description ||
      config.startingUrl !== selectedStartingUrl
    )
    
    setTestName(config.name)
    setTestDescription(config.description)
    setSelectedStartingUrl(config.startingUrl)
    setConfigurationComplete(true)
    setShowConfigModal(false)
    // setConfigModified(wasModified || false) // Currently unused
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test builder...</div>
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
        <div className="h-screen flex flex-col">
          {/* Minimal Header - Editable name + edit button */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 flex-1">
                {isEditingName ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={handleNameKeyPress}
                      onBlur={handleSaveNameEdit}
                      autoFocus
                      className="text-lg font-medium text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none min-w-0 flex-1"
                      placeholder="Enter test name"
                    />
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={handleSaveNameEdit}
                        className="p-1 text-green-600 hover:text-green-800 text-xs"
                        title="Save (Enter)"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelNameEdit}
                        className="p-1 text-red-600 hover:text-red-800 text-xs"
                        title="Cancel (Escape)"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 group">
                    <h1 className="text-lg font-medium text-gray-900">
                      {testName}
                    </h1>
                    <button
                      onClick={handleStartNameEdit}
                      className="p-1 text-gray-400 hover:text-gray-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Click to edit test name"
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleEditConfiguration}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Edit Config
              </button>
            </div>
          </div>

          {/* Full-Height Test Builder */}
          <div className="flex-1 overflow-hidden">
            <TestBuilder
              onSave={handleSave}
              onCancel={handleCancel}
              initialSteps={test?.steps || []}
              projectId={projectId}
              testId={testId}
              startingUrl={selectedStartingUrl}
            />
          </div>
        </div>
      )}

      {/* Navigation Blocking Modal */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">
                ⚠️ Unsaved Changes
              </h3>
              <p className="text-gray-600 mb-6">
                You have unsaved changes that will be lost if you leave this page. 
                Would you like to save your test before leaving?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={async () => {
                    // Save current test steps from localStorage
                    if (testId) {
                      const savedSteps = localStorage.getItem(`test-steps-${testId}`);
                      if (savedSteps) {
                        try {
                          const parsedSteps = JSON.parse(savedSteps);
                          await handleSave(parsedSteps);
                        } catch (e) {
                          console.error('Failed to save before navigation:', e);
                        }
                      }
                    }
                    blocker.proceed();
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save & Leave
                </button>
                <button
                  onClick={() => {
                    // Clear localStorage and proceed
                    if (testId) {
                      localStorage.removeItem(`test-steps-${testId}`);
                    }
                    setHasUnsavedChanges(false);
                    blocker.proceed();
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Discard & Leave
                </button>
                <button
                  onClick={() => blocker.reset()}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}