import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationContainer } from './components/notifications/NotificationContainer'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { ProjectDetailsPage } from './pages/projects/ProjectDetailsPage'
import { ProjectAnalysisPage } from './pages/projects/ProjectAnalysisPage'
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
import './index.css'

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/register", 
    element: <RegisterPage />
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <DashboardPage />
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
        path: "projects/:projectId/analyze",
        element: <ProjectAnalysisPage />
      },
      {
        path: "projects/:projectId/auth/setup",
        element: <AuthSetupPage />
      },
      // Test Suites Routes
      {
        path: "projects/:id/suites",
        element: <TestSuitesPage />
      },
      {
        path: "projects/:projectId/suites/:suiteId",
        element: <SuiteDetailsPage />
      },
      // Individual Tests Routes
      {
        path: "projects/:id/tests",
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
]);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
          <NotificationContainer />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App