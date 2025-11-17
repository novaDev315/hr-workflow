import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, Calendar, Users, DollarSign } from 'lucide-react'

export function ReportsPage() {
  const reportCategories = [
    {
      name: 'Employee Reports',
      icon: Users,
      reports: [
        { name: 'Employee Master Report', description: 'Complete employee data export' },
        { name: 'Department wise headcount', description: 'Employee distribution by department' },
        { name: 'New Hire Report', description: 'Recent joiners list' },
      ],
    },
    {
      name: 'Attendance Reports',
      icon: Calendar,
      reports: [
        { name: 'Monthly Attendance', description: 'Attendance summary for the month' },
        { name: 'Late Arrivals Report', description: 'Employees with late arrivals' },
        { name: 'Overtime Report', description: 'Overtime hours worked' },
      ],
    },
    {
      name: 'Payroll Reports',
      icon: DollarSign,
      reports: [
        { name: 'Salary Register', description: 'Monthly salary breakdown' },
        { name: 'PF/ESI Report', description: 'Statutory deductions summary' },
        { name: 'Payroll Cost Analysis', description: 'Department-wise payroll costs' },
      ],
    },
    {
      name: 'Leave Reports',
      icon: FileText,
      reports: [
        { name: 'Leave Balance Report', description: 'Employee leave balances' },
        { name: 'Leave Taken Report', description: 'Leave utilization summary' },
        { name: 'Leave Pending Approval', description: 'Pending leave applications' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Generate and download various HR reports</p>
      </div>

      {/* Report Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCategories.map((category) => (
          <Card key={category.name}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <category.icon className="w-5 h-5 text-primary" />
                <CardTitle>{category.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {category.reports.map((report) => (
                  <div key={report.name} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-sm">{report.name}</p>
                      <p className="text-xs text-muted-foreground">{report.description}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
