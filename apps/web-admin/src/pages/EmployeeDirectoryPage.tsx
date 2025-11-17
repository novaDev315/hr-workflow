import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Mail, Phone, Building } from 'lucide-react'

export function EmployeeDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')

  // TODO: Fetch from GraphQL
  const employees = [
    {
      id: '1',
      employeeNumber: 'EMP20240001',
      name: 'Rahul Kumar',
      email: 'rahul.kumar@company.com',
      phone: '+91 9876543210',
      department: 'Engineering',
      designation: 'Senior Developer',
      avatar: 'RK',
    },
    {
      id: '2',
      employeeNumber: 'EMP20240002',
      name: 'Priya Sharma',
      email: 'priya.sharma@company.com',
      phone: '+91 9876543211',
      department: 'HR',
      designation: 'HR Manager',
      avatar: 'PS',
    },
    {
      id: '3',
      employeeNumber: 'EMP20240003',
      name: 'Amit Patel',
      email: 'amit.patel@company.com',
      phone: '+91 9876543212',
      department: 'Engineering',
      designation: 'Tech Lead',
      avatar: 'AP',
    },
    {
      id: '4',
      employeeNumber: 'EMP20240004',
      name: 'Sneha Reddy',
      email: 'sneha.reddy@company.com',
      phone: '+91 9876543213',
      department: 'Sales',
      designation: 'Sales Executive',
      avatar: 'SR',
    },
  ]

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employeeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.designation.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Directory</h1>
        <p className="text-muted-foreground">
          Search and connect with your colleagues
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, employee ID, department, or designation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <Card key={employee.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                  {employee.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{employee.name}</h3>
                  <p className="text-sm text-muted-foreground">{employee.employeeNumber}</p>
                  <p className="text-sm font-medium mt-1">{employee.designation}</p>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span className="truncate">{employee.department}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${employee.email}`} className="text-primary hover:underline truncate">
                        {employee.email}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{employee.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No employees found matching your search.</p>
        </div>
      )}
    </div>
  )
}
