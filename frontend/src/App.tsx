import { createBrowserRouter, RouterProvider, Navigate, useNavigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationContainer } from './components/notifications/NotificationContainer'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { ProjectDetailsPage } from './pages/projects/ProjectDetailsPage'
import { TestsPage } from './pages/tests/TestsPage'
import { ErrorBoundary } from './components/error/ErrorBoundary'
import { TestSuitesPage } from './pages/tests/TestSuitesPage'
import { SuiteDetailsPage } from './pages/tests/SuiteDetailsPage'
import { TestBuilderPage } from './pages/tests/TestBuilderPage'
import { TestResultsPage } from './pages/tests/TestResultsPage'
import { SuiteResultsPage } from './pages/tests/SuiteResultsPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { AuthSetupPage } from './pages/auth/AuthSetupPage'
import { ProfileSettingsPage } from './pages/settings/ProfileSettingsPage'
import { NotificationSettingsPage } from './pages/settings/NotificationSettingsPage'
import './index.css'

// Component to handle auth logout events from API interceptor
function AuthLogoutListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthLogout = (event: any) => {
      console.log('🔓 Auth logout event received:', event.detail);
      navigate('/login', { replace: true });
    };

    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, [navigate]);

  return <Outlet />;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthLogoutListener />,
    children: [
      {
        path: "login",
        element: <LoginPage />
      },
      {
        path: "register",
        element: <RegisterPage />
      },
      {
        index: true,
        element: <LandingPage />
      },
      {
        element: (
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        ),
        children: [
          {
            path: "dashboard",
            element: <DashboardPage />
          },
      {
        path: "settings/profile",
        element: <ProfileSettingsPage />
      },
      {
        path: "settings/notifications",
        element: <NotificationSettingsPage />
      },
      {
        path: "projects",
        element: <ProjectsPage />
      },
      {
        path: "projects/:projectId",
        element: <ProjectDetailsPage />
      },
      {
        path: "projects/:projectId/auth/setup",
        element: <AuthSetupPage />
      },
      // Test Suites Routes
      {
        path: "projects/:projectId/suites",
        element: <TestSuitesPage />
      },
      {
        path: "projects/:projectId/suites/:suiteId",
        element: <SuiteDetailsPage />
      },
      // Individual Tests Routes
      {
        path: "projects/:projectId/tests",
        element: <TestsPage />
      },
      {
        path: "projects/:projectId/tests/new",
        element: <TestBuilderPage />
      },
      {
        path: "projects/:projectId/tests/:testId/edit",
        element: <TestBuilderPage />
      },
      {
        path: "tests/:testId/results",
        element: <TestResultsPage />
      },
          {
            path: "suites/:suiteId/results",
            element: <SuiteResultsPage />
          }
        ]
      }
    ]
  }
]);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
            <NotificationContainer />
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App