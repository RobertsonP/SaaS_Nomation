import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { projectsAPI } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface Project {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdAt: string;
  _count: { tests: number };
}

interface DashboardStats {
  totalProjects: number;
  totalTests: number;
  successRate: number;
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<DashboardStats>({ totalProjects: 0, totalTests: 0, successRate: 0 })
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await projectsAPI.getAll()
      setProjects(response.data)
      
      // Calculate stats
      const totalProjects = response.data.length
      const totalTests = response.data.reduce((sum: number, project: any) => sum + project._count.tests, 0)
      
      // For now, show N/A or 0% when no tests exist
      // TODO: Later fetch actual test execution results to calculate real success rate
      let successRate = 0
      if (totalTests === 0) {
        successRate = 0
      } else {
        // Placeholder until we implement actual success rate calculation
        successRate = 0
      }
      
      setStats({ totalProjects, totalTests, successRate })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading your projects...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
        <p className="text-gray-600 mt-2">Here's your test automation overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900">Total Projects</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalProjects}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900">Total Tests</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.totalTests}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900">Success Rate</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">
            {stats.totalTests === 0 ? 'N/A' : `${stats.successRate}%`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Projects</h2>
        </div>
        <div className="p-6">
          {projects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No projects yet</p>
              <Link
                to="/projects"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Create Your First Project
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onDoubleClick={() => navigate(`/projects/${project.id}`)}
                  title="Double-click to open project details"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      <p className="text-gray-600">{project.description}</p>
                      <p className="text-sm text-gray-500 mt-1">{project.url}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">{project._count.tests} tests</p>
                      <p className="text-xs text-gray-400">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}