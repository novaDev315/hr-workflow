import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pencil, UserX } from 'lucide-react'

export type EmployeeListRow = {
  id: string
  employeeNumber: string
  fullName: string
  email: string
  phone?: string | null
  firstName: string
  lastName: string
  departmentId: string
  designationId: string
  employmentType: string
  hasLinkedAccount: boolean
  linkedAccountEmail?: string | null
  linkedAccountRoles: string[]
  joinDate: string
  status: string
  isActive: boolean
  department: { name: string }
  designation: { title: string }
}

export function EmployeeListCard({
  accountManagerAccess,
  deactivatingEmployee,
  employees,
  error,
  handleDeactivateEmployee,
  handleEditEmployee,
  loading,
}: {
  accountManagerAccess: boolean
  deactivatingEmployee: boolean
  employees: EmployeeListRow[]
  error?: { message: string }
  handleDeactivateEmployee: (employeeId: string, fullName: string) => void
  handleEditEmployee: (employee: EmployeeListRow) => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <p className="app-kicker">Roster</p>
        <CardTitle>Employee List</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading employees...</p>
        ) : error ? (
          <Notice tone="danger">Unable to load employee data. {error.message}</Notice>
        ) : employees.length === 0 ? (
          <AdminTableEmpty>
            No employees found yet. Use "Add Records" to create the first team.
          </AdminTableEmpty>
        ) : (
          <AdminTable>
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left">Employee #</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-left">Login</th>
                <th className="px-4 py-3 text-left">Join Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                {accountManagerAccess ? (
                  <th className="px-4 py-3 text-left">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <AdminTableRow key={employee.id}>
                  <td className="px-4 py-3 font-medium">{employee.employeeNumber}</td>
                  <td className="px-4 py-3">{employee.fullName}</td>
                  <td className="px-4 py-3">{employee.email}</td>
                  <td className="px-4 py-3">{employee.department.name}</td>
                  <td className="px-4 py-3">{employee.designation.title}</td>
                  <td className="px-4 py-3">
                    {employee.hasLinkedAccount ? (
                      <div className="space-y-2">
                        <StatusBadge tone="info">
                          {employee.linkedAccountEmail || 'Linked'}
                        </StatusBadge>
                        {employee.linkedAccountRoles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {employee.linkedAccountRoles.map((role) => (
                              <StatusBadge key={role} tone="neutral">
                                {role}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <StatusBadge tone="warning">No login</StatusBadge>
                    )}
                  </td>
                  <td className="px-4 py-3">{employee.joinDate}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                      {employee.status}
                    </StatusBadge>
                  </td>
                  {accountManagerAccess ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleEditEmployee(employee)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        {employee.isActive ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={deactivatingEmployee}
                            onClick={() =>
                              handleDeactivateEmployee(employee.id, employee.fullName)
                            }
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </AdminTableRow>
              ))}
            </tbody>
          </AdminTable>
        )}
      </CardContent>
    </Card>
  )
}
