import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { LogOut, User, Bell, Sun, Moon, ChevronLeft, ChevronRight, LayoutDashboard, FolderKanban } from 'lucide-react'

const SIDEBAR_KEY = 'nomation-sidebar-collapsed'

export function Layout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(SIDEBAR_KEY) === '1'
  })

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        // localStorage may be unavailable; ignore.
      }
      return next
    })
  }

  const isActive = (path: string) => {
    return location.pathname === path
      ? 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30'
      : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-blue-400 dark:hover:bg-gray-800'
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-64'
  const mainOffset = collapsed ? 'ml-16' : 'ml-64'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Sidebar Navigation */}
      <aside className={`${sidebarWidth} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed h-full z-10 flex flex-col transition-all duration-200`}>
        <div className="h-16 flex items-center justify-between px-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 gap-2">
          {!collapsed && (
            <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center pl-3">
              Nomation
            </Link>
          )}
          <div className={`flex items-center gap-1 ${collapsed ? 'mx-auto flex-col' : ''}`}>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleCollapsed}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className={`${collapsed ? 'p-2' : 'p-4'} space-y-1 flex-1 overflow-y-auto`}>
          <Link
            to="/dashboard"
            className={`flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2'} text-sm font-medium rounded-lg transition-colors ${isActive('/dashboard')}`}
            title="Dashboard"
          >
            <LayoutDashboard className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
            {!collapsed && 'Dashboard'}
          </Link>
          <Link
            to="/projects"
            className={`flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2'} text-sm font-medium rounded-lg transition-colors ${isActive('/projects')}`}
            title="Projects"
          >
            <FolderKanban className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
            {!collapsed && 'Projects'}
          </Link>

          <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-700">
            {!collapsed && (
              <p className="px-4 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">User Settings</p>
            )}
            <Link
              to="/settings/profile"
              className={`flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2'} text-sm font-medium rounded-lg transition-colors ${isActive('/settings/profile')}`}
              title="Profile"
            >
              <User className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
              {!collapsed && 'Profile'}
            </Link>
            <Link
              to="/settings/notifications"
              className={`flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'px-4 py-2'} text-sm font-medium rounded-lg transition-colors ${isActive('/settings/notifications')}`}
              title="Notifications"
            >
              <Bell className={`w-4 h-4 ${collapsed ? '' : 'mr-2'}`} />
              {!collapsed && 'Notifications'}
            </Link>
          </div>
        </nav>

        <div className={`${collapsed ? 'p-2' : 'p-4'} border-t border-gray-100 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50 transition-colors`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center min-w-0 ${collapsed ? '' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs" title={user?.name}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <div className="ml-3 truncate">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user?.name}</p>
                  <button onClick={logout} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 flex items-center mt-0.5 transition-colors">
                    <LogOut className="w-3 h-3 mr-1" /> Logout
                  </button>
                </div>
              )}
            </div>
            {collapsed && (
              <button
                onClick={logout}
                className="absolute bottom-2 right-2 p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 ${mainOffset} p-8 bg-gray-50 dark:bg-gray-900 min-h-screen transition-all duration-200`}>
        <Outlet />
      </main>
    </div>
  )
}