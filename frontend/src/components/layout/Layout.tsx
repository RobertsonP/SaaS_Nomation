import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { LogOut, User, Bell, Sun, Moon } from 'lucide-react'

export function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed h-full z-10 flex flex-col transition-colors duration-200">
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center">
            Nomation
          </Link>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          <Link to="/dashboard" className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard')}`}>
            Dashboard
          </Link>
          <Link to="/projects" className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/projects')}`}>
            Projects
          </Link>

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">User Settings</p>
            <Link to="/settings/profile" className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/settings/profile')}`}>
              <User className="w-4 h-4 mr-2" /> Profile
            </Link>
            <Link to="/settings/notifications" className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isActive('/settings/notifications')}`}>
              <Bell className="w-4 h-4 mr-2" /> Notifications
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 truncate">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user?.name}</p>
                <button onClick={logout} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center mt-0.5 transition-colors">
                  <LogOut className="w-3 h-3 mr-1" /> Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  )
}