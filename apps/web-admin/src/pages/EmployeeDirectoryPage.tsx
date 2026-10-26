import { Navigate } from 'react-router-dom'

// The directory merged into People (card view). Keep old links working.
export function EmployeeDirectoryPage() {
  return <Navigate replace to="/employees" />
}
