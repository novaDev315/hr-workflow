import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './components/layouts/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { EmployeeDirectoryPage } from './pages/EmployeeDirectoryPage'
import { AttendancePage } from './pages/AttendancePage'
import { LeavePage } from './pages/LeavePage'
import { PayrollPage } from './pages/PayrollPage'
import { RecruitmentPage } from './pages/RecruitmentPage'
import { ReportsPage } from './pages/ReportsPage'
import { PolicyDocumentsPage } from './pages/PolicyDocumentsPage'
import { DemoGalleryPage } from './demo/pages/DemoGalleryPage'
import { DemoWorkspacePage } from './demo/pages/DemoWorkspacePage'
import {
  clearAdminSession,
  useAdminSession,
} from './lib/auth-session'

function App() {
  const { isAuthenticated, hasAccess } = useAdminSession()

  useEffect(() => {
    if (isAuthenticated && !hasAccess) {
      clearAdminSession()
    }
  }, [hasAccess, isAuthenticated])

  return (
    <Routes>
      <Route path="/demos" element={<DemoGalleryPage />} />
      <Route path="/demos/:demoId" element={<DemoWorkspacePage />} />
      <Route path="/demos/:demoId/:pageId" element={<DemoWorkspacePage />} />
      <Route
        path="/login"
        element={
          isAuthenticated && hasAccess ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route
        path="/"
        element={
          isAuthenticated && hasAccess ? (
            <DashboardLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="directory" element={<EmployeeDirectoryPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="recruitment" element={<RecruitmentPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="policies" element={<PolicyDocumentsPage />} />
      </Route>
    </Routes>
  )
}

export default App
