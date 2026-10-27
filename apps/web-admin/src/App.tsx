import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import {
  clearAdminSession,
  useAdminSession,
} from './lib/auth-session'
import {
  AccountSettingsPage,
  AttendancePage,
  DashboardPage,
  EmployeesPage,
  LeavePage,
  OrganisationPage,
  PayrollPage,
  PolicyDocumentsPage,
  RecruitmentPage,
  ReportsPage,
} from './pages/lazy-pages'

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage }))
)
const DashboardLayout = lazy(() =>
  import('./components/layouts/DashboardLayout').then((module) => ({
    default: module.DashboardLayout,
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
