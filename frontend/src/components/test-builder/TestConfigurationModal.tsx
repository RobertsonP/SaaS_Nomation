import { useState, useEffect } from 'react'

interface ProjectUrl {
  id: string
  url: string
  title?: string
  description?: string
}

interface Project {
  id: string
  name: string
  urls: ProjectUrl[]
}

interface TestConfigurationModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: {
    name: string
    description: string
    startingUrl: string
  }) => void
  project: Project | null
  initialConfig?: {
    name: string
    description: string
    startingUrl: string
  }
  isEdit?: boolean
}

export function TestConfigurationModal({
  isOpen,
  onClose,
  onSave,
  project,
  initialConfig,
  isEdit = false
}: TestConfigurationModalProps) {
  const [testName, setTestName] = useState('')
  const [testDescription, setTestDescription] = useState('')
  const [selectedStartingUrl, setSelectedStartingUrl] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setTestName(initialConfig.name)
        setTestDescription(initialConfig.description)
        setSelectedStartingUrl(initialConfig.startingUrl)
      } else {
        // Set defaults for new test
        setTestName('New Test')
        setTestDescription('Created with Test Builder')
        if (project?.urls && project.urls.length > 0) {
          setSelectedStartingUrl(project.urls[0].url)
        }
      }
      setErrors({})
    }
  }, [isOpen, initialConfig, project])

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      
      if (e.key === 'Escape') {
        handleCancel()
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!testName.trim()) {
      newErrors.name = 'Test name is required'
    }

    if (!selectedStartingUrl) {
      newErrors.startingUrl = 'Starting URL is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setSaving(true)
    try {
      onSave({
        name: testName.trim(),
        description: testDescription.trim(),
        startingUrl: selectedStartingUrl
      })
      // Small delay to show the saving state
      await new Promise(resolve => setTimeout(resolve, 300))
      onClose()
    } catch (error) {
      // Error handling if needed
      console.error('Failed to save configuration:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">
                {isEdit ? 'Edit Test Configuration' : 'Configure New Test'}
              </h2>
              <p className="text-gray-600 mt-1">
                Set up your test details and starting conditions
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-6">
            {/* Project Info */}
            {project && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-blue-900 mb-1">Project</h3>
                    <p className="text-blue-800">{project.name}</p>
                  </div>
                  {isEdit && (
                    <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      ✏️ Editing Configuration
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
                placeholder="Enter a descriptive name for your test"
                autoFocus
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {/* Test Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Description
              </label>
              <textarea
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                rows={3}
                placeholder="Describe what this test does (optional)"
              />
              <p className="mt-1 text-xs text-gray-500">
                Provide a clear description of what this test validates
              </p>
            </div>

            {/* Starting URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Starting URL <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStartingUrl}
                onChange={(e) => setSelectedStartingUrl(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
                  errors.startingUrl ? 'border-red-300 bg-red-50' : 'border-gray-300'
                }`}
              >
                <option value="">Select the starting page for this test...</option>
                {project?.urls?.map((projectUrl) => (
                  <option key={projectUrl.id} value={projectUrl.url}>
                    {projectUrl.title || new URL(projectUrl.url).pathname} - {projectUrl.url}
                  </option>
                ))}
              </select>
              {errors.startingUrl && (
                <p className="mt-1 text-sm text-red-600">{errors.startingUrl}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Choose which page the test should start from
              </p>
            </div>

            {/* URL Count Info */}
            {project?.urls && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{project.urls.length}</span> page{project.urls.length !== 1 ? 's' : ''} available in this project
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-xs">Esc</kbd> to cancel, 
              <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-xs ml-1">Ctrl+Enter</kbd> to save
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!testName.trim() || !selectedStartingUrl || saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
              >
                {saving && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 818-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {saving ? 'Saving...' : (isEdit ? 'Update Configuration' : 'Start Building Test')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}