import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { NotificationContainer } from './components/notifications/NotificationContainer'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { ProjectDetailsPage } from './pages/projects/ProjectDetailsPage'
import { TestsPage } from './pages/tests/TestsPage'
import { TestBuilderPage } from './pages/tests/TestBuilderPage'
import { TestResultsPage } from './pages/tests/TestResultsPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { AuthSetupPage } from './pages/auth/AuthSetupPage'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:projectId" element={<ProjectDetailsPage />} />
            <Route path="projects/:projectId/auth/setup" element={<AuthSetupPage />} />
            <Route path="projects/:id/tests" element={<TestsPage />} />
            <Route path="projects/:projectId/tests/new" element={<TestBuilderPage />} />
            <Route path="projects/:projectId/tests/:testId/edit" element={<TestBuilderPage />} />
            <Route path="tests/:testId/results" element={<TestResultsPage />} />
          </Route>
        </Routes>
        <NotificationContainer />
      </Router>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App