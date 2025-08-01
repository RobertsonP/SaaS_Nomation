import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { testsAPI, projectsAPI, executionAPI } from '../../lib/api'

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
      await executionAPI.run(testId)
      alert('Test execution started! Check the Results page for updates.')
    } catch (error) {
      console.error('Failed to run test:', error)
      alert('Failed to start test execution')
    }
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
                    <button
                      onClick={() => handleRunTest(test.id)}
                      disabled={test.steps.length === 0}
                      className="text-green-600 hover:text-green-800 text-sm disabled:text-gray-400"
                    >
                      Run Test
                    </button>
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
    </div>
  )
}