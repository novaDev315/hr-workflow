import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Briefcase, Calendar, DollarSign } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function DashboardPage() {
  // TODO: Fetch actual data from GraphQL
  const stats = [
    {
      title: 'Total Employees',
      value: '247',
      icon: Users,
      change: '+12 this month',
      changeType: 'positive' as const,
    },
    {
      title: 'Present Today',
      value: '235',
      icon: Briefcase,
      change: '95.1% attendance',
      changeType: 'positive' as const,
    },
    {
      title: 'Leave Requests',
      value: '18',
      icon: Calendar,
      change: '6 pending approval',
      changeType: 'neutral' as const,
    },
    {
      title: 'Monthly Payroll',
      value: formatCurrency(12450000),
      icon: DollarSign,
      change: '+5.2% from last month',
      changeType: 'positive' as const,
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your HR operations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                action: 'New employee onboarded',
                employee: 'Rahul Kumar',
                time: '2 hours ago',
              },
              {
                action: 'Leave approved',
                employee: 'Priya Sharma',
                time: '4 hours ago',
              },
              {
                action: 'Payroll processed',
                employee: 'November 2024',
                time: '1 day ago',
              },
              {
                action: 'Attendance marked',
                employee: '235 employees',
                time: 'Today',
              },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.action}</p>
                  <p className="text-xs text-muted-foreground">{activity.employee}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
