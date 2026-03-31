import { useDeferredValue, useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, Mail, Phone, Building } from 'lucide-react'

const EMPLOYEE_DIRECTORY_QUERY = gql`
  query EmployeeDirectory($filter: EmployeeFilterInput) {
    employees(filter: $filter) {
      id
      employeeNumber
      fullName
      email
      phone
      department {
        name
      }
      designation {
        title
      }
    }
  }
`

export function EmployeeDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const deferredSearch = useDeferredValue(searchQuery)

  const { data, loading, error } = useQuery(EMPLOYEE_DIRECTORY_QUERY, {
    variables: {
      filter: deferredSearch.trim()
        ? {
            search: deferredSearch.trim(),
          }
        : null,
    },
  })

  const employees = data?.employees ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employee Directory</h1>
        <p className="text-muted-foreground">
          Search and connect with your colleagues using live employee data.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, employee ID, department, or designation..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading directory...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-sm text-red-700">
            Unable to load the employee directory. {error.message}
          </CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No employees found matching your search.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees.map(
            (employee: {
              id: string
              employeeNumber: string
              fullName: string
              email: string
              phone?: string | null
              department: { name: string }
              designation: { title: string }
            }) => (
              <Card key={employee.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
                      {employee.fullName
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold">{employee.fullName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {employee.employeeNumber}
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {employee.designation.title}
                      </p>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate">{employee.department.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={`mailto:${employee.email}`}
                            className="truncate text-primary hover:underline"
                          >
                            {employee.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{employee.phone || 'No phone recorded'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  )
}
