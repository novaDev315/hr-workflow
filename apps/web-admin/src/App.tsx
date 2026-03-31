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
import {
  clearAdminSession,
  hasAdminPanelAccess,
  readStoredAdminAccount,
} from './lib/auth-session'

function App() {
  const token = localStorage.getItem('auth_token')
  const storedAccount = readStoredAdminAccount()
  const isAuthenticated = Boolean(token && storedAccount)
  const hasAccess = storedAccount ? hasAdminPanelAccess(storedAccount.roles) : false

  if (isAuthenticated && !hasAccess) {
    clearAdminSession()
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
