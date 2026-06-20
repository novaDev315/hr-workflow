import { useDeferredValue, useState } from 'react'
import { gql, useQuery } from '@apollo/client'
import { Building, Mail, Phone, Search, Users } from 'lucide-react'

import { AdminTableEmpty } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'

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
      filter: deferredSearch.trim() ? { search: deferredSearch.trim() } : null,
    },
  })

  const employees = data?.employees ?? []

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(260px,0.4fr)]">
        <Card>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div>
              <p className="app-kicker">Directory</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
                Search people without leaving the page.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Keep contact details and team context visible, but only when they help the task.
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-11"
                placeholder="Search by name, employee ID, department, or designation"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <MetricCard
          detail={deferredSearch.trim() ? 'Filtered results' : 'All directory entries'}
          icon={Users}
          label="People found"
          tone="bg-sky-100 text-sky-800"
          value={String(employees.length)}
        />
      </div>

      <PageFeedback
        loadError={error}
        loadErrorPrefix="Unable to load the employee directory."
      />

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading directory...</CardContent>
        </Card>
      ) : employees.length === 0 ? (
        <AdminTableEmpty>No employees found for this search.</AdminTableEmpty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              <Card key={employee.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-semibold text-primary">
                      {employee.fullName
                        .split(' ')
                        .slice(0, 2)
                        .map((part) => part[0] ?? '')
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="truncate font-semibold text-foreground">{employee.fullName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {employee.employeeNumber} · {employee.designation.title}
                        </p>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          <span className="truncate">{employee.department.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <a className="truncate text-primary hover:underline" href={`mailto:${employee.email}`}>
                            {employee.email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
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
