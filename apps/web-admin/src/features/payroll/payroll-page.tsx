import { useMemo, useState, type FormEvent } from 'react'
import { useApolloClient, useMutation, useQuery } from '@apollo/client'
import { Plus, Settings2 } from 'lucide-react'

import { AdminHero } from '@/components/admin/admin-hero'
import { AdminTableEmpty } from '@/components/admin/admin-table'
import { PageFeedback } from '@/components/admin/page-feedback'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDrawer } from '@/components/ui/form-drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { Notice } from '@/components/ui/notice'
import { toast } from '@/lib/toast'
import { ListToolbar } from '@/features/shared/list-toolbar'
import { matchesSearch } from '@/features/shared/use-show-more'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { downloadBase64File } from '@/lib/download-export'
import { currentMonthLocal, formatMoney, formatMonth, plural, todayLocal } from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'

import {
  CompensationForm,
  CompensationRegister,
  PayrollPeriodList,
  PayrollPeriodSummary,
  PayslipTable,
  ProcessPayrollDialog,
  type CompensationFormState,
} from './components'
import {
  CREATE_PAYROLL_PERIOD_MUTATION,
  DELETE_PAYROLL_PERIOD_MUTATION,
  EXPORT_PAYSLIP_PDF_QUERY,
  EXPORT_PAYROLL_PERIOD_PAYSLIPS_PDF_QUERY,
  MARK_PAYROLL_PERIOD_PAID_MUTATION,
  PAYROLL_PAGE_QUERY,
  PAYSLIPS_QUERY,
  PROCESS_PAYROLL_PERIOD_MUTATION,
  UPSERT_COMPENSATION_MUTATION,
  type CompensationProfile,
  type PayrollEmployee,
  type PayrollPeriod,
  type Payslip,
} from './graphql'
import { sortPeriodsNewestFirst } from './presentation'

function compensationDefaults(): CompensationFormState {
  return {
    employeeId: '',
    baseSalary: '',
    allowanceAmount: '0',
    deductionAmount: '0',
    effectiveFrom: todayLocal(),
    notes: '',
  }
}

type PayrollPageData = {
  employees: PayrollEmployee[]
  employeeCompensations: CompensationProfile[]
  payrollPeriods: PayrollPeriod[]
}

export function PayrollPage() {
  const apolloClient = useApolloClient()
  const { account } = useAdminSession()
  const canManagePayroll = canManageAccounts(account)

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [newPeriodMonth, setNewPeriodMonth] = useState(currentMonthLocal())
  const [compensationForm, setCompensationForm] = useState(compensationDefaults)
  const [compensationError, setCompensationError] = useState<string | null>(null)
  const [registerSearch, setRegisterSearch] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const [dialog, setDialog] = useState<'process' | 'paid' | 'delete' | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)

  const { data, loading, error, refetch } = useQuery<PayrollPageData>(PAYROLL_PAGE_QUERY, {
    skip: !canManagePayroll,
  })

  const employees = useMemo(() => data?.employees ?? [], [data?.employees])
  const compensationProfiles = useMemo(
    () => data?.employeeCompensations ?? [],
    [data?.employeeCompensations],
  )
  const payrollPeriods = useMemo(
    () => sortPeriodsNewestFirst(data?.payrollPeriods ?? []),
    [data?.payrollPeriods],
  )

  // The selected period is always explicit: the chosen one, or the most
  // recent. Title, summary and payslip rows all use this same id.
  const selectedPeriod =
    payrollPeriods.find((period) => period.id === selectedPeriodId) ?? payrollPeriods[0] ?? null
  const selectedId = selectedPeriod?.id ?? null

  const {
    data: payslipData,
    loading: payslipsLoading,
    error: payslipsError,
    refetch: refetchPayslips,
  } = useQuery<{ payslips: Payslip[] }>(PAYSLIPS_QUERY, {
    skip: !canManagePayroll || !selectedId,
    variables: { filter: { payrollPeriodId: selectedId } },
  })
  const payslips = (payslipData?.payslips ?? []).filter(
    (payslip) => payslip.payrollPeriodId === selectedId,
  )

  const [upsertCompensation, { loading: savingCompensation }] = useMutation(UPSERT_COMPENSATION_MUTATION)
  const [createPayrollPeriod, { loading: creatingPeriod }] = useMutation(CREATE_PAYROLL_PERIOD_MUTATION)
  const [processPayrollPeriod, { loading: processing }] = useMutation(PROCESS_PAYROLL_PERIOD_MUTATION)
  const [markPayrollPeriodPaid, { loading: markingPaid }] = useMutation(MARK_PAYROLL_PERIOD_PAID_MUTATION)
  const [deletePayrollPeriod, { loading: deleting }] = useMutation(DELETE_PAYROLL_PERIOD_MUTATION)
  const busy = processing || markingPaid || deleting

  const activeEmployees = employees.filter((employee) => employee.isActive !== false)
  const employeesWithCompensation = new Set(compensationProfiles.map((profile) => profile.employeeId))
  const coveredCount = activeEmployees.filter((employee) => employeesWithCompensation.has(employee.id)).length
  const periodCurrency = payslips[0]?.currencyCode ?? compensationProfiles[0]?.currencyCode ?? 'AED'

  const filteredProfiles = compensationProfiles.filter((profile) =>
    matchesSearch(registerSearch, [profile.employee.fullName, profile.employee.employeeNumber]),
  )
  const replacingCompensation = compensationProfiles.some(
    (profile) => profile.employeeId === compensationForm.employeeId,
  )

  // Switching employee never carries the previous person's figures over:
  // someone who already has pay gets their current amounts, anyone else
  // starts from the defaults.
  const changeCompensationForm = (next: CompensationFormState) => {
    if (next.employeeId !== compensationForm.employeeId) {
      const existing = compensationProfiles.find((profile) => profile.employeeId === next.employeeId)
      const defaults = compensationDefaults()
      setCompensationForm({
        ...next,
        baseSalary: existing ? String(existing.baseSalary) : defaults.baseSalary,
        allowanceAmount: existing ? String(existing.allowanceAmount) : defaults.allowanceAmount,
        deductionAmount: existing ? String(existing.deductionAmount) : defaults.deductionAmount,
      })
      return
    }
    setCompensationForm(next)
  }

  const openCompensation = (profile?: CompensationProfile) => {
    setCompensationError(null)
    setCompensationForm(
      profile
        ? {
            ...compensationDefaults(),
            employeeId: profile.employeeId,
            baseSalary: String(profile.baseSalary),
            allowanceAmount: String(profile.allowanceAmount),
            deductionAmount: String(profile.deductionAmount),
          }
        : compensationDefaults(),
    )
    setShowSetup(true)
  }

  const refreshAll = async () => {
    await Promise.all([refetch(), selectedId ? refetchPayslips() : Promise.resolve()])
  }

  const handleSaveCompensation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCompensationError(null)
    if (!compensationForm.employeeId) {
      setCompensationError('Choose the employee whose pay you are setting.')
      return
    }
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
      const person = employees.find((employee) => employee.id === compensationForm.employeeId)
      setCompensationForm(compensationDefaults())
      setShowSetup(false)
      toast.success(`Pay saved${person ? ` for ${person.fullName}` : ''}.`)
      await refetch()
    } catch (mutationError) {
      setCompensationError(readableError(mutationError, 'Could not save compensation.'))
    }
  }

  const handleCreatePeriod = async () => {
    try {
      const result = await createPayrollPeriod({ variables: { input: { periodMonth: newPeriodMonth } } })
      const createdId = result.data?.createPayrollPeriod?.id as string | undefined
      if (createdId) setSelectedPeriodId(createdId)
      toast.success(`${formatMonth(newPeriodMonth)} payroll period created.`)
      await refetch()
    } catch (mutationError) {
      toast.error(readableError(mutationError, 'Could not create the payroll period.'))
    }
  }

  const handleProcess = async () => {
    if (!selectedPeriod) return
    try {
      await processPayrollPeriod({ variables: { input: { payrollPeriodId: selectedPeriod.id } } })
      setDialog(null)
      toast.success(`${formatMonth(selectedPeriod.periodMonth)} payroll processed.`)
      await refreshAll()
    } catch (mutationError) {
      setDialog(null)
      toast.error(readableError(mutationError, 'Could not process payroll.'))
    }
  }

  const handleMarkPaid = async () => {
    if (!selectedPeriod) return
    try {
      await markPayrollPeriodPaid({ variables: { input: { payrollPeriodId: selectedPeriod.id } } })
      setDialog(null)
      toast.success(`${formatMonth(selectedPeriod.periodMonth)} payroll marked as paid.`)
      await refreshAll()
    } catch (mutationError) {
      setDialog(null)
      toast.error(readableError(mutationError, 'Could not mark the period as paid.'))
    }
  }

  const handleDelete = async () => {
    if (!selectedPeriod) return
    try {
      await deletePayrollPeriod({ variables: { input: { payrollPeriodId: selectedPeriod.id } } })
      setDialog(null)
      setSelectedPeriodId(null)
      toast.success(`${formatMonth(selectedPeriod.periodMonth)} payroll period deleted.`)
      await refetch()
    } catch (mutationError) {
      setDialog(null)
      toast.error(readableError(mutationError, 'Could not delete the payroll period.'))
    }
  }

  const handleDownloadPayslip = async (payslipId: string) => {
    setDownloadingId(payslipId)
    try {
      const { data: exportData } = await apolloClient.query({
        query: EXPORT_PAYSLIP_PDF_QUERY,
        variables: { payslipId },
        fetchPolicy: 'no-cache',
      })
      const payload = exportData?.exportPayslipPdf
      if (!payload) throw new Error('This payslip could not be exported.')
      downloadBase64File(payload.fileName, payload.mimeType, payload.contentBase64)
      toast.success(`Downloaded ${payload.fileName}.`)
    } catch (queryError) {
      toast.error(readableError(queryError, 'Could not download the payslip.'))
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDownloadAllPayslips = async () => {
    if (!selectedPeriod) return
    setDownloadingAll(true)
    try {
      const { data: exportData } = await apolloClient.query({
        query: EXPORT_PAYROLL_PERIOD_PAYSLIPS_PDF_QUERY,
        variables: { payrollPeriodId: selectedPeriod.id },
        fetchPolicy: 'no-cache',
      })
      const payload = exportData?.exportPayrollPeriodPayslipsPdf
      if (!payload) throw new Error('These payslips could not be exported.')
      downloadBase64File(payload.fileName, payload.mimeType, payload.contentBase64)
      toast.success(`Downloaded ${payload.fileName}.`)
    } catch (queryError) {
      toast.error(readableError(queryError, 'Could not download the payslips.'))
    } finally {
      setDownloadingAll(false)
    }
  }

  if (!canManagePayroll) {
    return (
      <div className="space-y-4">
        <AdminHero title="Payroll" />
        <Notice tone="info">Payroll is available to admin and HR admin accounts only.</Notice>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminHero
        title="Payroll"
        description="Create a period, check it, process payroll, then mark it as paid."
        actions={
          <Button variant="outline" onClick={() => openCompensation()}>
            <Settings2 className="mr-2 h-4 w-4" />
            Compensation setup
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <MetricCard
          label="Compensation"
          value={`${coveredCount} of ${activeEmployees.length}`}
          detail={
            activeEmployees.length - coveredCount > 0
              ? `${plural(activeEmployees.length - coveredCount, 'employee')} missing compensation`
              : 'Active employees with compensation'
          }
        />
        <MetricCard
          label="Net pay"
          value={selectedPeriod ? formatMoney(selectedPeriod.totalNetPay, periodCurrency) : '—'}
          detail={selectedPeriod ? formatMonth(selectedPeriod.periodMonth) : 'No period selected'}
        />
        <MetricCard
          className="col-span-2 sm:col-span-1"
          label="Payslips"
          value={String(selectedPeriod?.payslipCount ?? 0)}
          detail={selectedPeriod ? `Generated for ${formatMonth(selectedPeriod.periodMonth)}` : 'No period selected'}
        />
      </div>

      {error ? <PageFeedback loadError={error} loadErrorPrefix="Payroll data could not be loaded." /> : null}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle>Periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex min-w-0 items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="period-month">New period</Label>
                <Input
                  id="period-month"
                  type="month"
                  value={newPeriodMonth}
                  onChange={(event) => setNewPeriodMonth(event.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={handleCreatePeriod}
                disabled={creatingPeriod || !newPeriodMonth}
                aria-label="Create payroll period"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Create
              </Button>
            </div>

            {loading && !data ? (
              <p className="text-sm text-muted-foreground">Loading payroll periods…</p>
            ) : payrollPeriods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payroll periods yet. Create one for the month you want to pay.
              </p>
            ) : (
              <PayrollPeriodList
                periods={payrollPeriods}
                selectedId={selectedId}
                onSelect={(id) => {
                                setSelectedPeriodId(id)
                }}
              />
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardContent className="h-full p-4 sm:p-5">
            {selectedPeriod ? (
              <PayrollPeriodSummary
                period={selectedPeriod}
                payslips={payslips}
                payslipsLoading={payslipsLoading && !payslipData}
                busy={busy}
                onProcess={() => setDialog('process')}
                onMarkPaid={() => setDialog('paid')}
                onDelete={() => setDialog('delete')}
                onDownloadAll={handleDownloadAllPayslips}
                downloadingAll={downloadingAll}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select or create a payroll period to see its summary.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle>
            {selectedPeriod ? `Payslips · ${formatMonth(selectedPeriod.periodMonth)}` : 'Payslips'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payslipsError ? (
            <PageFeedback loadError={payslipsError} loadErrorPrefix="Payslips could not be loaded." />
          ) : !selectedPeriod ? (
            <AdminTableEmpty>Select a payroll period to see its payslips.</AdminTableEmpty>
          ) : payslipsLoading && !payslipData ? (
            <p className="text-sm text-muted-foreground">Loading payslips…</p>
          ) : payslips.length === 0 ? (
            <AdminTableEmpty>
              No payslips for {formatMonth(selectedPeriod.periodMonth)} yet. Process payroll to
              generate them.
            </AdminTableEmpty>
          ) : (
            <PayslipTable payslips={payslips} downloadingId={downloadingId} onDownload={handleDownloadPayslip} />
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle>Compensation register</CardTitle>
        </CardHeader>
        <CardContent>
          {compensationProfiles.length === 0 ? (
            <AdminTableEmpty>No compensation yet. Use Compensation setup to add someone's pay.</AdminTableEmpty>
          ) : (
            <div className="space-y-3">
              <ListToolbar
                noun={['person', 'people']}
                onClear={() => setRegisterSearch('')}
                onSearchChange={setRegisterSearch}
                search={registerSearch}
                searchLabel="Search compensation register"
                searchPlaceholder="Search name or number"
                shown={filteredProfiles.length}
                total={compensationProfiles.length}
              />
              <CompensationRegister onEdit={openCompensation} profiles={filteredProfiles} />
            </div>
          )}
        </CardContent>
      </Card>

      <FormDrawer
        open={showSetup}
        onOpenChange={setShowSetup}
        title="Compensation setup"
        description="Set the monthly salary, allowances and fixed deductions for an employee."
      >
        <CompensationForm
          value={compensationForm}
          onChange={changeCompensationForm}
          employees={employees}
          saving={savingCompensation}
          error={compensationError}
          replacing={replacingCompensation}
          onSubmit={handleSaveCompensation}
        />
      </FormDrawer>

      <ProcessPayrollDialog
        open={dialog === 'process'}
        onOpenChange={(open) => setDialog(open ? 'process' : null)}
        period={selectedPeriod}
        employees={employees}
        compensations={compensationProfiles}
        busy={processing}
        onConfirm={handleProcess}
      />

      <ConfirmDialog
        open={dialog === 'paid'}
        onOpenChange={(open) => setDialog(open ? 'paid' : null)}
        title={selectedPeriod ? `Mark ${formatMonth(selectedPeriod.periodMonth)} as paid?` : 'Mark as paid?'}
        description="Do this after salaries have been sent. The period is then closed and employees can see their payslips."
        confirmLabel="Mark as paid"
        busy={markingPaid}
        onConfirm={handleMarkPaid}
      >
        {selectedPeriod ? (
          <dl className="app-muted-surface grid grid-cols-2 gap-4 p-4">
            <div>
              <dt className="text-[13px] text-muted-foreground">Payslips</dt>
              <dd className="text-base font-semibold tabular-nums">{selectedPeriod.payslipCount}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Total net pay</dt>
              <dd className="text-base font-semibold tabular-nums">
                {formatMoney(selectedPeriod.totalNetPay, periodCurrency)}
              </dd>
            </div>
          </dl>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => setDialog(open ? 'delete' : null)}
        title={selectedPeriod ? `Delete ${formatMonth(selectedPeriod.periodMonth)} payroll period?` : 'Delete period?'}
        description={
          selectedPeriod && selectedPeriod.payslipCount > 0
            ? `Its ${plural(selectedPeriod.payslipCount, 'payslip')} will be removed. This cannot be undone.`
            : 'This cannot be undone.'
        }
        confirmLabel="Delete period"
        tone="destructive"
        busy={deleting}
        onConfirm={handleDelete}
      />
    </div>
  )
}
