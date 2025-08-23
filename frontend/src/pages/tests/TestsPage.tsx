import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { testsAPI, projectsAPI, executionAPI } from '../../lib/api'
import { LiveExecutionViewer } from '../../components/execution/LiveExecutionViewer'

interface Test {
  id: string
  name: string
  description?: string
  status: string
  steps: any[]
  createdAt: string
}

interface Project {
  id: string
  name: string
  description?: string
}

export function TestsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [tests, setTests] = useState<Test[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set())
  const [testProgress, setTestProgress] = useState<Record<string, number>>({})
  const [liveExecutionTest, setLiveExecutionTest] = useState<{id: string; name: string} | null>(null)
  const [newTest, setNewTest] = useState({
    name: '',
    description: '',
    startingUrl: ''
  })

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
      console.error('Failed to load project and tests:', error)
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
      console.error('Failed to create test:', error)
    }
  }

  const handleRunTest = async (testId: string) => {
    try {
      // Add test to running state
      setRunningTests(prev => new Set([...prev, testId]))
      setTestProgress(prev => ({ ...prev, [testId]: 0 }))
      
      // Start test execution
      await executionAPI.run(testId)
      
      // Simulate progress updates (in real implementation, this would come from WebSocket or polling)
      simulateTestProgress(testId)
      
    } catch (error) {
      console.error('Failed to run test:', error)
      
      // Remove from running state on error
      setRunningTests(prev => {
        const newSet = new Set(prev)
        newSet.delete(testId)
        return newSet
      })
      setTestProgress(prev => {
        const newProgress = { ...prev }
        delete newProgress[testId]
        return newProgress
      })
      
      // Show error notification instead of alert
      // Note: You should use a proper notification system here
      console.error('Failed to start test execution')
    }
  }

  const handleRunTestLive = async (testId: string, testName: string) => {
    // Open live execution viewer
    setLiveExecutionTest({ id: testId, name: testName })
  }

  const handleLiveExecutionComplete = (result: any) => {
    console.log('Live execution completed:', result)
    // Could navigate to results or show success message
  }

  const closeLiveExecution = () => {
    setLiveExecutionTest(null)
  }

  const simulateTestProgress = (testId: string) => {
    let progress = 10
    const interval = setInterval(() => {
      progress += Math.random() * 20
      
      if (progress >= 100) {
        progress = 100
        setTestProgress(prev => ({ ...prev, [testId]: progress }))
        
        // Complete the test after a short delay
        setTimeout(() => {
          setRunningTests(prev => {
            const newSet = new Set(prev)
            newSet.delete(testId)
            return newSet
          })
          setTestProgress(prev => {
            const newProgress = { ...prev }
            delete newProgress[testId]
            return newProgress
          })
        }, 1000)
        
        clearInterval(interval)
      } else {
        setTestProgress(prev => ({ ...prev, [testId]: progress }))
      }
    }, 500)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading tests...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <Link to="/projects" className="text-blue-600 hover:text-blue-800">
            ← Back to Projects
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
        <p className="text-gray-600 mt-2">{project?.description}</p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Tests</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Test
          </button>
        </div>
      </div>

      {/* Running Tests Display */}
      {runningTests.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center mb-3">
            <div className="flex items-center">
              <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-blue-800">
                Running Tests ({runningTests.size})
              </h3>
            </div>
          </div>
          
          <div className="space-y-3">
            {Array.from(runningTests).map(testId => {
              const test = tests.find(t => t.id === testId)
              const progress = testProgress[testId] || 0
              
              return (
                <div key={testId} className="bg-white rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{test?.name}</h4>
                      <p className="text-sm text-gray-600">Executing test steps...</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-blue-700">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="flex justify-end mt-2">
                    <Link
                      to={`/tests/${testId}/results`}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View Results →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showCreateForm && (
        <div className="bg-white rounded-lg shadow border p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Test</h3>
          <form onSubmit={handleCreateTest}>
            <div className="grid grid-cols-1 gap-4 mb-4">
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
            <div className="flex space-x-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Test
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border">
        {tests.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No tests created yet</p>
            <div className="space-y-4">
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Test
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {tests.map((test) => (
              <div key={test.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{test.name}</h3>
                    {test.description && (
                      <p className="text-gray-600 mt-1">{test.description}</p>
                    )}
                    <div className="flex items-center mt-2 space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        test.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {test.steps.length} steps
                      </span>
                      <span className="text-sm text-gray-500">
                        Created {new Date(test.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Link
                      to={`/projects/${projectId}/tests/${test.id}/edit`}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </Link>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleRunTest(test.id)}
                        disabled={test.steps.length === 0 || runningTests.has(test.id)}
                        className={`text-sm font-medium px-3 py-1 rounded transition-colors ${
                          runningTests.has(test.id)
                            ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                            : test.steps.length === 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                        }`}
                      >
                        {runningTests.has(test.id) ? (
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center">
                              <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Running
                            </div>
                            {testProgress[test.id] !== undefined && (
                              <span className="text-xs">
                                {Math.round(testProgress[test.id])}%
                              </span>
                            )}
                          </div>
                        ) : (
                          'Run'
                        )}
                      </button>
                      
                      <button
                        onClick={() => handleRunTestLive(test.id, test.name)}
                        disabled={test.steps.length === 0 || runningTests.has(test.id)}
                        className={`text-sm font-medium px-2 py-1 rounded transition-colors ${
                          test.steps.length === 0 || runningTests.has(test.id)
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                        }`}
                        title="Run with live viewport viewer"
                      >
                        🎬
                      </button>
                    </div>
                    <Link
                      to={`/tests/${test.id}/results`}
                      className="text-purple-600 hover:text-purple-800 text-sm"
                    >
                      View Results
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Live Execution Viewer */}
      {liveExecutionTest && (
        <LiveExecutionViewer
          testId={liveExecutionTest.id}
          testName={liveExecutionTest.name}
          isOpen={!!liveExecutionTest}
          onClose={closeLiveExecution}
          onExecutionComplete={handleLiveExecutionComplete}
        />
      )}
    </div>
  )
}