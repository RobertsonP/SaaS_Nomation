import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { TestBuilder } from '../../components/test-builder/TestBuilder'
import { TestConfigurationModal } from '../../components/test-builder/TestConfigurationModal'
import { testsAPI, projectsAPI } from '../../lib/api'
import { useNotification } from '../../contexts/NotificationContext'

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
  const [configModified, setConfigModified] = useState(false)

  useEffect(() => {
    loadData()
  }, [projectId, testId])

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
        setConfigModified(false) // Clear modified flag after successful save
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
    setConfigModified(wasModified || false)
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
          {/* Minimal Header - ONLY name + edit button */}
          <div className="bg-white border-b border-gray-200 px-4 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-medium text-gray-900">
                {testName}
              </h1>
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
            />
          </div>
        </div>
      )}
    </>
  )
}