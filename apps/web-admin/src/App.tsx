import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  clearAdminSession,
  useAdminSession,
} from './lib/auth-session'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const DashboardLayout = lazy(() =>
  import('./components/layouts/DashboardLayout').then((module) => ({
    default: module.DashboardLayout,
  }))
)
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  }))
)
const EmployeesPage = lazy(() =>
  import('./pages/EmployeesPage').then((module) => ({
    default: module.EmployeesPage,
  }))
)
const OrganisationPage = lazy(() =>
  import('./pages/OrganisationPage').then((module) => ({
    default: module.OrganisationPage,
  }))
)
const AttendancePage = lazy(() =>
  import('./pages/AttendancePage').then((module) => ({
    default: module.AttendancePage,
  }))
)
const LeavePage = lazy(() =>
  import('./pages/LeavePage').then((module) => ({ default: module.LeavePage }))
)
const PayrollPage = lazy(() =>
  import('./pages/PayrollPage').then((module) => ({
    default: module.PayrollPage,
  }))
)
const RecruitmentPage = lazy(() =>
  import('./pages/RecruitmentPage').then((module) => ({
    default: module.RecruitmentPage,
  }))
)
const ReportsPage = lazy(() =>
  import('./pages/ReportsPage').then((module) => ({
    default: module.ReportsPage,
  }))
)
const PolicyDocumentsPage = lazy(() =>
  import('./pages/PolicyDocumentsPage').then((module) => ({
    default: module.PolicyDocumentsPage,
  }))
)
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((module) => ({
    default: module.AccountSettingsPage,
  }))
)

function AppLoadingFallback() {
  return <div className="min-h-screen bg-background text-foreground" />
}

function App() {
  const { isAuthenticated, hasAccess } = useAdminSession()

  useEffect(() => {
    if (isAuthenticated && !hasAccess) {
      void clearAdminSession()
    }
  }, [hasAccess, isAuthenticated])

  return (
    <Suspense fallback={<AppLoadingFallback />}>
      <Routes>
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
          <Route path="directory" element={<Navigate to="/employees" replace />} />
          <Route path="people" element={<Navigate to="/employees" replace />} />
          <Route path="organisation" element={<OrganisationPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="leave" element={<LeavePage />} />
          <Route path="payroll" element={<PayrollPage />} />
          <Route path="recruitment" element={<RecruitmentPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="policies" element={<PolicyDocumentsPage />} />
          <Route path="account" element={<AccountSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default App
