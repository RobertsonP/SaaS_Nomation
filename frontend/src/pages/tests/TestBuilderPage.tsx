import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { TestBuilder } from '../../components/test-builder/TestBuilder'
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
      } else {
        // Set default name for new test
        setTestName('New Test')
        setTestDescription('Created with Test Builder')
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
        // Update existing test
        await testsAPI.updateSteps(testId, steps)
        showSuccess('Test Updated', `Successfully updated test "${testName}" with ${steps.length} step${steps.length !== 1 ? 's' : ''}`)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading test builder...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to={`/projects/${projectId}/tests`} className="text-blue-600 hover:text-blue-800">
            ← Back to Tests
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">
          {testId ? `Edit Test: ${test?.name}` : 'Create New Test'}
        </h1>
        <p className="text-gray-600 mt-2">
          Project: {project?.name}
        </p>
      </div>

      {/* Test Configuration Form */}
      <div className="bg-white rounded-lg shadow border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Test Configuration</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Name
            </label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter test name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Starting URL
            </label>
            <select
              value={selectedStartingUrl}
              onChange={(e) => setSelectedStartingUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select starting page...</option>
              {project?.urls?.map((projectUrl) => (
                <option key={projectUrl.id} value={projectUrl.url}>
                  {projectUrl.title || new URL(projectUrl.url).pathname} - {projectUrl.url}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose which page the test should start from
            </p>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Test Description
            </label>
            <textarea
              value={testDescription}
              onChange={(e) => setTestDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Describe what this test does"
            />
          </div>
        </div>
      </div>

      <TestBuilder
        onSave={handleSave}
        onCancel={handleCancel}
        initialSteps={test?.steps || []}
        projectId={projectId}
      />
    </div>
  )
}