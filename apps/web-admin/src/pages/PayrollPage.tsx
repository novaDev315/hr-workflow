import { FormEvent, useMemo, useState } from 'react'
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client'
import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTable, AdminTableEmpty, AdminTableRow } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { RecordCard } from '@/components/admin/record-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreditCard, Receipt, Trash2, Wallet } from 'lucide-react'
import { MetricCard } from '@/components/ui/metric-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { canManageAccounts, readStoredAdminAccount } from '@/lib/auth-session'
import { downloadBase64File } from '@/lib/download-export'

const PAYROLL_PAGE_QUERY = gql`
  query PayrollPageData($filter: PayslipFilterInput) {
    employees {
      id
      employeeNumber
      fullName
      department {
        name
      }
      designation {
        title
      }
    }
    employeeCompensations {
      id
      employeeId
      baseSalary
      allowanceAmount
      deductionAmount
      currencyCode
      effectiveFrom
      employee {
        id
        employeeNumber
        fullName
      }
    }
    payrollPeriods {
      id
      periodMonth
      startDate
      endDate
      status
      processedAt
      paidAt
      payslipCount
      totalNetPay
    }
    payslips(filter: $filter) {
      id
      payrollPeriodId
      periodMonth
      expectedWorkdays
      attendedDays
      approvedLeaveDays
      paidDays
      unpaidDays
      grossPay
      netPay
      attendanceDeduction
      deductionAmount
      allowanceAmount
      currencyCode
      status
      employee {
        id
        employeeNumber
        fullName
      }
    }
  }
`

const UPSERT_COMPENSATION_MUTATION = gql`
  mutation UpsertEmployeeCompensation($input: UpsertEmployeeCompensationInput!) {
    upsertEmployeeCompensation(input: $input) {
      id
    }
  }
`

const CREATE_PAYROLL_PERIOD_MUTATION = gql`
  mutation CreatePayrollPeriod($input: CreatePayrollPeriodInput!) {
    createPayrollPeriod(input: $input) {
      id
      status
    }
  }
`

const PROCESS_PAYROLL_PERIOD_MUTATION = gql`
  mutation ProcessPayrollPeriod($input: ProcessPayrollPeriodInput!) {
    processPayrollPeriod(input: $input) {
      id
      status
    }
  }
`

const MARK_PAYROLL_PERIOD_PAID_MUTATION = gql`
  mutation MarkPayrollPeriodPaid($input: MarkPayrollPeriodPaidInput!) {
    markPayrollPeriodPaid(input: $input) {
      id
      status
    }
  }
`

const DELETE_PAYROLL_PERIOD_MUTATION = gql`
  mutation DeletePayrollPeriod($input: DeletePayrollPeriodInput!) {
    deletePayrollPeriod(input: $input)
  }
`

const EXPORT_PAYSLIP_PDF_QUERY = gql`
  query ExportPayslipPdf($payslipId: String!) {
    exportPayslipPdf(payslipId: $payslipId) {
      fileName
      mimeType
      contentBase64
    }
  }
`

type CompensationFormState = {
  employeeId: string
  baseSalary: string
  allowanceAmount: string
  deductionAmount: string
  effectiveFrom: string
  notes: string
}

const compensationFormDefaults: CompensationFormState = {
  employeeId: '',
  baseSalary: '',
  allowanceAmount: '0',
  deductionAmount: '0',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  notes: '',
}

export function PayrollPage() {
  const apolloClient = useApolloClient()
  const currentAdminAccount = readStoredAdminAccount()
  const canManagePayroll = canManageAccounts(currentAdminAccount?.roles ?? [])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7))
  const [compensationForm, setCompensationForm] = useState(compensationFormDefaults)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)

  const { data, loading, error, refetch } = useQuery(PAYROLL_PAGE_QUERY, {
    skip: !canManagePayroll,
    variables: {
      filter: selectedPeriodId
        ? {
            payrollPeriodId: selectedPeriodId,
          }
        : null,
    },
  })

  const [upsertCompensation, { loading: savingCompensation }] = useMutation(
    UPSERT_COMPENSATION_MUTATION
  )
  const [createPayrollPeriod, { loading: creatingPayrollPeriod }] = useMutation(
    CREATE_PAYROLL_PERIOD_MUTATION
  )
  const [processPayrollPeriod, { loading: processingPayrollPeriod }] = useMutation(
    PROCESS_PAYROLL_PERIOD_MUTATION
  )
  const [markPayrollPeriodPaid, { loading: markingPayrollPeriodPaid }] = useMutation(
    MARK_PAYROLL_PERIOD_PAID_MUTATION
  )
  const [deletePayrollPeriod, { loading: deletingPayrollPeriod }] = useMutation(
    DELETE_PAYROLL_PERIOD_MUTATION
  )

  const employees = data?.employees ?? []
  const compensationProfiles = data?.employeeCompensations ?? []
  const payrollPeriods = data?.payrollPeriods ?? []
  const payslips = data?.payslips ?? []

  const selectedPeriod = useMemo(
    () =>
      payrollPeriods.find((period: { id: string }) => period.id === selectedPeriodId) ??
      payrollPeriods[0] ??
      null,
    [payrollPeriods, selectedPeriodId]
  )

  const handleSaveCompensation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await upsertCompensation({
        variables: {
          input: {
            employeeId: compensationForm.employeeId,
            baseSalary: Number.parseFloat(compensationForm.baseSalary),
            allowanceAmount: Number.parseFloat(compensationForm.allowanceAmount || '0'),
            deductionAmount: Number.parseFloat(compensationForm.deductionAmount || '0'),
            effectiveFrom: compensationForm.effectiveFrom,
            notes: compensationForm.notes || null,
          },
        },
      })

      setCompensationForm(compensationFormDefaults)
      setStatusMessage('Compensation profile saved.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to save compensation profile.'
      )
    }
  }

  const handleCreatePayrollPeriod = async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await createPayrollPeriod({
        variables: {
          input: {
            periodMonth,
          },
        },
      })
      setStatusMessage('Payroll period created.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create payroll period.'
      )
    }
  }

  const handleProcessPayrollPeriod = async (payrollPeriodId: string) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await processPayrollPeriod({
        variables: {
          input: {
            payrollPeriodId,
          },
        },
      })
      setStatusMessage('Payroll processed.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to process payroll.'
      )
    }
  }

  const handleMarkPeriodPaid = async (payrollPeriodId: string) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await markPayrollPeriodPaid({
        variables: {
          input: {
            payrollPeriodId,
          },
        },
      })
      setStatusMessage('Payroll period marked as paid.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to mark payroll period as paid.'
      )
    }
  }

  const handleDeletePayrollPeriod = async (payrollPeriodId: string, periodMonth: string) => {
    if (!window.confirm(`Delete payroll period ${periodMonth}? Generated payslips for it will be removed.`)) {
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    try {
      await deletePayrollPeriod({
        variables: {
          input: {
            payrollPeriodId,
          },
        },
      })
      if (selectedPeriodId === payrollPeriodId) {
        setSelectedPeriodId(null)
      }
      setStatusMessage('Payroll period deleted.')
      await refetch()
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete payroll period.'
      )
    }
  }

  const handleDownloadPayslip = async (payslipId: string) => {
    setErrorMessage(null)
    setStatusMessage(null)

    try {
      const { data: exportData } = await apolloClient.query({
        query: EXPORT_PAYSLIP_PDF_QUERY,
        variables: { payslipId },
        fetchPolicy: 'no-cache',
      })

      const exportPayload = exportData?.exportPayslipPdf
      if (!exportPayload) {
        throw new Error('Payslip export is unavailable.')
      }

      downloadBase64File(
        exportPayload.fileName,
        exportPayload.mimeType,
        exportPayload.contentBase64
      )
      setStatusMessage('Payslip PDF downloaded.')
    } catch (mutationError) {
      setErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to export payslip PDF.'
      )
    }
  }

  if (!canManagePayroll) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Payroll access is limited to ADMIN and HR_ADMIN accounts.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminHero
        kicker="Payroll workspace"
        title="Keep the monthly cycle clear and low-noise."
        description="Process periods, inspect payslips, and open compensation setup only when changes are needed."
        actions={
          <Button variant="outline" onClick={() => setShowSetup(true)}>
            Open compensation setup
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail="Saved compensation profiles"
          icon={Wallet}
          label="Compensation"
          tone="bg-sky-100 text-sky-800"
          value={String(compensationProfiles.length)}
        />
        <MetricCard
          detail="Payroll periods created"
          icon={CreditCard}
          label="Periods"
          tone="bg-emerald-100 text-emerald-800"
          value={String(payrollPeriods.length)}
        />
        <MetricCard
          detail="Payslips in current view"
          icon={Receipt}
          label="Payslips"
          tone="bg-amber-100 text-amber-800"
          value={String(payslips.length)}
        />
      </div>

      <PageFeedback errorMessage={errorMessage} statusMessage={statusMessage} />

      <div className="grid gap-4 xl:grid-cols-2">
        <FormDrawer
          open={showSetup}
          onOpenChange={setShowSetup}
          kicker="Payroll setup"
          title="Compensation setup"
          description="Update compensation profiles without leaving the payroll cycle."
        >
          <Card>
            <CardHeader>
              <p className="app-kicker">Setup</p>
              <CardTitle>Compensation Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSaveCompensation}>
              <div className="space-y-2">
                <Label htmlFor="compensation-employee">Employee</Label>
                <select
                  id="compensation-employee"
                  value={compensationForm.employeeId}
                  onChange={(event) =>
                    setCompensationForm((current) => ({
                      ...current,
                      employeeId: event.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select employee</option>
                  {employees.map(
                    (employee: {
                      id: string
                      employeeNumber: string
                      fullName: string
                    }) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} ({employee.employeeNumber})
                      </option>
                    )
                  )}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="base-salary">Base Salary</Label>
                  <Input
                    id="base-salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value={compensationForm.baseSalary}
                    onChange={(event) =>
                      setCompensationForm((current) => ({
                        ...current,
                        baseSalary: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="effective-from">Effective From</Label>
                  <Input
                    id="effective-from"
                    type="date"
                    value={compensationForm.effectiveFrom}
                    onChange={(event) =>
                      setCompensationForm((current) => ({
                        ...current,
                        effectiveFrom: event.target.value,
                      }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="allowance-amount">Allowance Amount</Label>
                  <Input
                    id="allowance-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={compensationForm.allowanceAmount}
                    onChange={(event) =>
                      setCompensationForm((current) => ({
                        ...current,
                        allowanceAmount: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deduction-amount">Fixed Deductions</Label>
                  <Input
                    id="deduction-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={compensationForm.deductionAmount}
                    onChange={(event) =>
                      setCompensationForm((current) => ({
                        ...current,
                        deductionAmount: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="compensation-notes">Notes</Label>
                <Input
                  id="compensation-notes"
                  value={compensationForm.notes}
                  onChange={(event) =>
                    setCompensationForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional compensation notes"
                />
              </div>
              <Button type="submit" disabled={savingCompensation || employees.length === 0}>
                {savingCompensation ? 'Saving...' : 'Save Compensation'}
              </Button>
            </form>
            </CardContent>
          </Card>
        </FormDrawer>

        <Card>
          <CardHeader>
            <p className="app-kicker">Cycle</p>
            <CardTitle>Payroll Periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="period-month">Period Month</Label>
                <Input
                  id="period-month"
                  type="month"
                  value={periodMonth}
                  onChange={(event) => setPeriodMonth(event.target.value)}
                />
              </div>
              <Button type="button" onClick={handleCreatePayrollPeriod} disabled={creatingPayrollPeriod}>
                {creatingPayrollPeriod ? 'Creating...' : 'Create Period'}
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading payroll periods...</p>
            ) : error ? (
              <p className="text-sm text-red-600">
                Unable to load payroll data. {error.message}
              </p>
            ) : payrollPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payroll periods created yet.
              </p>
            ) : (
              <div className="space-y-3">
                {payrollPeriods.map(
                  (period: {
                    id: string
                    periodMonth: string
                    status: string
                    payslipCount: number
                    totalNetPay: number
                  }) => (
                    <RecordCard
                      key={period.id}
                      className={
                        selectedPeriodId === period.id
                          ? 'border-primary/45 bg-primary/10'
                          : undefined
                      }
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium">{period.periodMonth}</p>
                          <p className="text-sm text-muted-foreground">
                            {period.payslipCount} payslips • Net {period.totalNetPay.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedPeriodId(period.id)}
                          >
                            View
                          </Button>
                          {period.status === 'OPEN' && (
                            <Button
                              type="button"
                              onClick={() => handleProcessPayrollPeriod(period.id)}
                              disabled={processingPayrollPeriod}
                            >
                              {processingPayrollPeriod ? 'Processing...' : 'Process'}
                            </Button>
                          )}
                          {period.status === 'PROCESSED' && (
                            <Button
                              type="button"
                              onClick={() => handleMarkPeriodPaid(period.id)}
                              disabled={markingPayrollPeriodPaid}
                            >
                              {markingPayrollPeriodPaid ? 'Updating...' : 'Mark Paid'}
                            </Button>
                          )}
                          {period.status !== 'PAID' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                handleDeletePayrollPeriod(period.id, period.periodMonth)
                              }
                              disabled={deletingPayrollPeriod}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </RecordCard>
                  )
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <p className="app-kicker">Register</p>
          <CardTitle>Compensation Register</CardTitle>
        </CardHeader>
        <CardContent>
          {compensationProfiles.length === 0 ? (
            <AdminTableEmpty>
              No compensation profiles configured yet.
            </AdminTableEmpty>
          ) : (
            <AdminTable>
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Base Salary</th>
                    <th className="px-4 py-3 text-left">Allowances</th>
                    <th className="px-4 py-3 text-left">Deductions</th>
                    <th className="px-4 py-3 text-left">Effective From</th>
                  </tr>
                </thead>
                <tbody>
                  {compensationProfiles.map(
                    (profile: {
                      id: string
                      baseSalary: number
                      allowanceAmount: number
                      deductionAmount: number
                      effectiveFrom: string
                      currencyCode: string
                      employee: { employeeNumber: string; fullName: string }
                    }) => (
                      <AdminTableRow key={profile.id}>
                        <td className="px-4 py-3">
                          {profile.employee.fullName}
                          <div className="text-xs text-muted-foreground">
                            {profile.employee.employeeNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {profile.currencyCode} {profile.baseSalary.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {profile.currencyCode} {profile.allowanceAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {profile.currencyCode} {profile.deductionAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">{profile.effectiveFrom}</td>
                      </AdminTableRow>
                    )
                  )}
                </tbody>
            </AdminTable>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="app-kicker">Payslips</p>
          <CardTitle>
            {selectedPeriod ? `Payslips for ${selectedPeriod.periodMonth}` : 'Recent Payslips'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payslips.length === 0 ? (
            <AdminTableEmpty>
              No payslips generated for the selected payroll period yet.
            </AdminTableEmpty>
          ) : (
            <AdminTable>
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Paid Days</th>
                    <th className="px-4 py-3 text-left">Gross Pay</th>
                    <th className="px-4 py-3 text-left">Net Pay</th>
                    <th className="px-4 py-3 text-left">Attendance Deduction</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Export</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map(
                    (payslip: {
                      id: string
                      paidDays: number
                      expectedWorkdays: number
                      grossPay: number
                      netPay: number
                      attendanceDeduction: number
                      currencyCode: string
                      status: string
                      employee: { employeeNumber: string; fullName: string }
                    }) => (
                      <AdminTableRow key={payslip.id}>
                        <td className="px-4 py-3">
                          {payslip.employee.fullName}
                          <div className="text-xs text-muted-foreground">
                            {payslip.employee.employeeNumber}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {payslip.paidDays}/{payslip.expectedWorkdays}
                        </td>
                        <td className="px-4 py-3">
                          {payslip.currencyCode} {payslip.grossPay.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {payslip.currencyCode} {payslip.netPay.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          {payslip.currencyCode} {payslip.attendanceDeduction.toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            tone={
                              payslip.status === 'PAID'
                                ? 'success'
                                : payslip.status === 'PROCESSED'
                                  ? 'info'
                                  : 'warning'
                            }
                          >
                            {payslip.status}
                          </StatusBadge>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleDownloadPayslip(payslip.id)}
                          >
                            Download PDF
                          </Button>
                        </td>
                      </AdminTableRow>
                    )
                  )}
                </tbody>
            </AdminTable>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
