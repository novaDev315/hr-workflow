import { Outlet, Link, useNavigate } from 'react-router-dom'
import {
  Users,
  Calendar,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Briefcase,
  UserSearch,
  FileText,
  BarChart3,
  BookOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Employees', href: '/employees', icon: Users },
    { name: 'Directory', href: '/directory', icon: UserSearch },
    { name: 'Attendance', href: '/attendance', icon: Briefcase },
    { name: 'Leave', href: '/leave', icon: Calendar },
    { name: 'Payroll', href: '/payroll', icon: DollarSign },
    { name: 'Recruitment', href: '/recruitment', icon: FileText },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Policies', href: '/policies', icon: BookOpen },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-primary">HRFlow Pro</h1>
            <p className="text-sm text-muted-foreground">Admin Panel</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
