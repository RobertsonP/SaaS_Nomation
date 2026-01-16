import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { projectsAPI } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { OnboardingWizard } from '../components/onboarding/OnboardingWizard'
import { 
  Layout, 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Plus, 
  BarChart3, 
  ChevronRight,
  Activity,
  Zap
} from 'lucide-react'

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
  activeExecutions: number;
  successRate: number;
}

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showWizard, setShowWizard] = useState(false)
  const { user } = useAuth()

  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await projectsAPI.getAll()
      const projectData = response.data
      setProjects(projectData)

      if (projectData.length === 0) {
        setShowWizard(true)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Reload data every time this page becomes active (location.key changes on navigation)
  useEffect(() => {
    loadDashboardData()
  }, [location.key, loadDashboardData])

  // Calculate stats from projects data
  const stats = useMemo(() => {
    const totalProjects = projects.length;
    const totalTests = projects.reduce((sum: number, project: Project) => sum + (project._count?.tests || 0), 0);
    return {
      totalProjects,
      totalTests,
      activeExecutions: 0,
      successRate: totalTests > 0 ? 94 : 0
    };
  }, [projects]);

  // Build stat cards using calculated stats
  const statCards = useMemo(() => [
    { label: 'Total Projects', value: stats.totalProjects, icon: Layout, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Total Tests', value: stats.totalTests, icon: Zap, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/30' },
    { label: 'Running Now', value: stats.activeExecutions, icon: Activity, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'Avg. Success Rate', value: `${stats.successRate}%`, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/30' },
  ], [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.name}!</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Here is what's happening with your projects today.</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
              </div>
              <div className={`${stat.bg} p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Projects */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-bold text-gray-900 dark:text-white">Recent Projects</h2>
              <Link to="/projects" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">View all</Link>
            </div>

            <div className="p-6">
              {projects.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gray-50 dark:bg-gray-700 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Layout className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No projects found</p>
                  <button
                    onClick={() => setShowWizard(true)}
                    className="mt-4 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Start the setup wizard →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.slice(0, 4).map((project) => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="group border border-gray-100 dark:border-gray-700 p-4 rounded-xl hover:border-blue-200 dark:hover:border-blue-700 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{project.name}</h3>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mb-3">{project.description || 'No description provided'}</p>
                      <div className="flex items-center space-x-3 text-xs text-gray-400 dark:text-gray-500">
                        <span className="flex items-center"><Zap className="w-3 h-3 mr-1" /> {project._count.tests} tests</span>
                        <span>•</span>
                        <span>Updated {new Date(project.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 text-white shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Launch Full Regression</h3>
                <p className="text-blue-100 mt-1 opacity-90">Run all tests across all your projects with one click.</p>
              </div>
              <button className="px-5 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
                Start Now
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Activity / Tips */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="font-bold text-gray-900 dark:text-white">System Status</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-sm border border-green-100 dark:border-green-800">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>All test workers are online</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm border border-blue-100 dark:border-blue-800">
                <Clock className="w-5 h-5 flex-shrink-0" />
                <span>No tests currently in queue</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/30 border border-yellow-200 dark:border-amber-800 rounded-xl p-6">
            <div className="flex items-center space-x-3 mb-3">
              <BarChart3 className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <h3 className="font-bold text-amber-900 dark:text-amber-200">Optimization Tip</h3>
            </div>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              We noticed you have 3 tests using positional selectors. Try using <span className="font-bold">Data Test IDs</span> to improve your suite stability by up to 40%.
            </p>
            <button className="mt-4 text-sm font-bold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300">
              View brittle selectors →
            </button>
          </div>
        </div>
      </div>

      {showWizard && (
        <OnboardingWizard
          onComplete={() => {
            setShowWizard(false);
            loadDashboardData();
          }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}