import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './components/layouts/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { EmployeesPage } from './pages/EmployeesPage'
import { AttendancePage } from './pages/AttendancePage'
import { LeavePage } from './pages/LeavePage'
import { PayrollPage } from './pages/PayrollPage'

function App() {
  const isAuthenticated = !!localStorage.getItem('auth_token')

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <DashboardLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
      </Route>
    </Routes>
  )
}

export default App
