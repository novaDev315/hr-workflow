import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function EmployeesPage() {
  // TODO: Fetch employees from GraphQL
  const employees = [
    {
      id: '1',
      employeeNumber: 'EMP20240001',
      name: 'Rahul Kumar',
      department: 'Engineering',
      designation: 'Senior Developer',
      status: 'ACTIVE',
    },
    {
      id: '2',
      employeeNumber: 'EMP20240002',
      name: 'Priya Sharma',
      department: 'HR',
      designation: 'HR Manager',
      status: 'ACTIVE',
    },
    {
      id: '3',
      employeeNumber: 'EMP20240003',
      name: 'Amit Patel',
      department: 'Engineering',
      designation: 'Tech Lead',
      status: 'ACTIVE',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">Manage your workforce</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Employee #</th>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Department</th>
                  <th className="text-left py-3 px-4">Designation</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{employee.employeeNumber}</td>
                    <td className="py-3 px-4">{employee.name}</td>
                    <td className="py-3 px-4">{employee.department}</td>
                    <td className="py-3 px-4">{employee.designation}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {employee.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
