import { useQuery } from '@apollo/client'
import { Download, Loader2, Pencil, Trash2 } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'

import {
  AdminTable,
  AdminTableCell,
  AdminTableEmpty,
  AdminTableHead,
  AdminTableRow,
} from '@/components/admin/admin-table'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Notice } from '@/components/ui/notice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { StepIndicator, type StepState } from '@/features/shared/step-indicator'
import { formatDateTime, formatDay, formatMoney, formatMonth, plural } from '@/lib/format'
import { isSchemaMismatch, readableError } from '@/lib/graphql-errors'
import { cn } from '@/lib/utils'

import {
  PAYROLL_PERIOD_PREVIEW_QUERY,
  type CompensationProfile,
  type PayrollEmployee,
  type PayrollPeriod,
  type PayrollPreview,
  type Payslip,
} from './graphql'
import {
  buildLocalPreview,
  formatPaidDays,
  periodStatusLabel,
  periodTone,
} from './presentation'

/* ---------- Period list ---------- */

export function PayrollPeriodList({
  periods,
  selectedId,
  onSelect,
}: {
  periods: PayrollPeriod[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul className="space-y-1.5" aria-label="Payroll periods">
      {periods.map((period) => {
        const selected = period.id === selectedId
        return (
          <li key={period.id}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(period.id)}
              className={cn(
                'flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary/40 bg-primary/[0.07]'
                  : 'border-transparent hover:bg-secondary/70',
              )}
            >
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-semibold text-foreground">
                  {formatMonth(period.periodMonth)}
                </span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {period.payslipCount > 0
                    ? plural(period.payslipCount, 'payslip')
                    : 'No payslips yet'}
                </span>
              </span>
              <StatusBadge tone={periodTone(period.status)}>
                {periodStatusLabel(period.status)}
              </StatusBadge>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Selected period summary ---------- */

// Where this period is in the run: process, then review and pay, then done.
function runSteps(status: string): { label: string; state: StepState }[] {
  const order = ['OPEN', 'PROCESSED', 'PAID']
  const at = Math.max(0, order.indexOf(status))
  const labels = ['Process', 'Mark paid', 'Paid']
  return labels.map((label, index) => ({
    label,
    state: status === 'PAID' || index < at ? 'done' : index === at ? 'current' : 'upcoming',
  }))
}

function SummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-semibold text-foreground tabular-nums">{value}</dd>
    </div>
  )
}

export function PayrollPeriodSummary({
  period,
  payslips,
  payslipsLoading,
  onProcess,
  onMarkPaid,
  onDelete,
  busy,
}: {
  period: PayrollPeriod
  payslips: Payslip[]
  payslipsLoading: boolean
  onProcess: () => void
  onMarkPaid: () => void
  onDelete: () => void
  busy: boolean
}) {
  const currency = payslips[0]?.currencyCode ?? 'AED'
  const gross = payslips.reduce((sum, payslip) => sum + payslip.grossPay, 0)
  const absence = payslips.reduce((sum, payslip) => sum + payslip.attendanceDeduction, 0)
  const deductions = payslips.reduce((sum, payslip) => sum + payslip.deductionAmount, 0)

  return (
    <div className="flex h-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="app-editorial text-[1.4rem] leading-tight text-foreground">
            {formatMonth(period.periodMonth)}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {formatDay(period.startDate)} – {formatDay(period.endDate)}
            {period.paidAt
              ? ` · Paid ${formatDateTime(period.paidAt)}`
              : period.processedAt
                ? ` · Processed ${formatDateTime(period.processedAt)}`
                : ''}
          </p>
        </div>
        <StatusBadge tone={periodTone(period.status)}>{periodStatusLabel(period.status)}</StatusBadge>
      </div>

      <StepIndicator steps={runSteps(period.status)} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <SummaryStat
          label="Gross pay"
          value={payslipsLoading ? '…' : formatMoney(gross, currency)}
        />
        <SummaryStat
          label="Deductions"
          value={payslipsLoading ? '…' : formatMoney(deductions, currency)}
        />
        <SummaryStat label="Net pay" value={formatMoney(period.totalNetPay, currency)} />
        <SummaryStat
          label="Unpaid absence"
          value={payslipsLoading ? '…' : formatMoney(absence, currency)}
        />
      </dl>

      <p className="text-[13px] leading-5 text-muted-foreground">
        {period.status === 'OPEN'
          ? 'Processing generates a payslip for every active employee with compensation. Full salary is paid, prorated only for join or exit dates and unpaid leave.'
          : period.status === 'PROCESSED'
            ? 'Payslips are ready. Mark the period as paid once salaries are sent; employees see their payslips after that.'
            : 'This period is closed. Employees can see these payslips.'}
        {period.status !== 'OPEN'
          ? ' Net pay is gross pay minus deductions; gross pay already excludes unpaid absence.'
          : ''}
      </p>

      <div className="mt-auto flex flex-wrap gap-2">
        {period.status === 'OPEN' ? (
          <Button type="button" onClick={onProcess} disabled={busy}>
            Process payroll
          </Button>
        ) : null}
        {period.status === 'PROCESSED' ? (
          <Button type="button" onClick={onMarkPaid} disabled={busy}>
            Mark as paid
          </Button>
        ) : null}
        {period.status !== 'PAID' ? (
          <Button type="button" variant="outline" onClick={onDelete} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete period
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Payslips ---------- */

export function PayslipTable({
  payslips,
  downloadingId,
  onDownload,
}: {
  payslips: Payslip[]
  downloadingId: string | null
  onDownload: (payslipId: string) => void
}) {
  return (
    // Fill the card and let long names wrap so the download column stays visible.
    <AdminTable caption="Payslips" density="compact" tableClassName="w-full">
      <thead>
        <tr>
          <AdminTableHead>Employee</AdminTableHead>
          <AdminTableHead>Paid days</AdminTableHead>
          <AdminTableHead numeric>Unpaid absence</AdminTableHead>
          <AdminTableHead numeric>Gross pay</AdminTableHead>
          <AdminTableHead numeric>Deductions</AdminTableHead>
          <AdminTableHead numeric>Net pay</AdminTableHead>
          <AdminTableHead>Status</AdminTableHead>
          <AdminTableHead>
            <span className="sr-only">Download</span>
          </AdminTableHead>
        </tr>
      </thead>
      <tbody>
        {payslips.map((payslip) => (
          <AdminTableRow key={payslip.id}>
            <AdminTableCell className="min-w-[10rem]">
              <div className="font-medium text-foreground"><bdi>{payslip.employee.fullName}</bdi></div>
              <div className="text-xs text-muted-foreground">{payslip.employee.employeeNumber}</div>
            </AdminTableCell>
            <AdminTableCell nowrap className="tabular-nums">
              {formatPaidDays(payslip.paidDays, payslip.expectedWorkdays)}
            </AdminTableCell>
            <AdminTableCell numeric>
              {payslip.attendanceDeduction > 0
                ? formatMoney(payslip.attendanceDeduction, payslip.currencyCode)
                : '—'}
            </AdminTableCell>
            <AdminTableCell numeric>{formatMoney(payslip.grossPay, payslip.currencyCode)}</AdminTableCell>
            <AdminTableCell numeric>
              {payslip.deductionAmount > 0
                ? `−${formatMoney(payslip.deductionAmount, payslip.currencyCode)}`
                : '—'}
            </AdminTableCell>
            <AdminTableCell numeric className="font-semibold text-foreground">
              {formatMoney(payslip.netPay, payslip.currencyCode)}
            </AdminTableCell>
            <AdminTableCell nowrap>
              <StatusBadge tone={periodTone(payslip.status)} value={payslip.status} />
            </AdminTableCell>
            <AdminTableCell nowrap className="text-right">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={downloadingId === payslip.id}
                onClick={() => onDownload(payslip.id)}
                aria-label={`Download payslip PDF for ${payslip.employee.fullName}`}
                className="px-2.5"
                title="Download PDF"
              >
                {downloadingId === payslip.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  )
}

/* ---------- Compensation register ---------- */

export function CompensationRegister({
  profiles,
  onEdit,
}: {
  profiles: CompensationProfile[]
  onEdit: (profile: CompensationProfile) => void
}) {
  if (profiles.length === 0) {
    return <AdminTableEmpty>No compensation profiles match.</AdminTableEmpty>
  }

  return (
    <AdminTable caption="Compensation register" density="compact">
      <thead>
        <tr>
          <AdminTableHead>Employee</AdminTableHead>
          <AdminTableHead numeric>Base salary</AdminTableHead>
          <AdminTableHead numeric>Allowances</AdminTableHead>
          <AdminTableHead numeric>Fixed deductions</AdminTableHead>
          <AdminTableHead>Effective from</AdminTableHead>
          <AdminTableHead>
            <span className="sr-only">Actions</span>
          </AdminTableHead>
        </tr>
      </thead>
      <tbody>
        {profiles.map((profile) => (
          <AdminTableRow key={profile.id}>
            <AdminTableCell nowrap>
              <div className="font-medium text-foreground"><bdi>{profile.employee.fullName}</bdi></div>
              <div className="text-xs text-muted-foreground">{profile.employee.employeeNumber}</div>
            </AdminTableCell>
            <AdminTableCell numeric>{formatMoney(profile.baseSalary, profile.currencyCode)}</AdminTableCell>
            <AdminTableCell numeric>{formatMoney(profile.allowanceAmount, profile.currencyCode)}</AdminTableCell>
            <AdminTableCell numeric>{formatMoney(profile.deductionAmount, profile.currencyCode)}</AdminTableCell>
            <AdminTableCell nowrap>{formatDay(profile.effectiveFrom)}</AdminTableCell>
            <AdminTableCell nowrap className="text-right">
              <Button
                aria-label={`Edit pay for ${profile.employee.fullName}`}
                onClick={() => onEdit(profile)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit
              </Button>
            </AdminTableCell>
          </AdminTableRow>
        ))}
      </tbody>
    </AdminTable>
  )
}

/* ---------- Compensation form ---------- */

export type CompensationFormState = {
  employeeId: string
  baseSalary: string
  allowanceAmount: string
  deductionAmount: string
  effectiveFrom: string
  notes: string
}

export function CompensationForm({
  value,
  onChange,
  employees,
  saving,
  error,
  replacing,
  onSubmit,
}: {
  value: CompensationFormState
  onChange: (next: CompensationFormState) => void
  employees: PayrollEmployee[]
  saving: boolean
  error?: string | null
  /** True when the chosen employee already has pay on record. */
  replacing?: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const set = (patch: Partial<CompensationFormState>) => onChange({ ...value, ...patch })

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {error ? (
        <Notice role="alert" tone="danger">
          {error}
        </Notice>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="compensation-employee">Employee</Label>
        <Select
          name="compensation-employee"
          value={value.employeeId}
          onValueChange={(employeeId) => set({ employeeId })}
          required
        >
          <SelectTrigger id="compensation-employee">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.fullName} ({employee.employeeNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {replacing ? (
          <p className="text-[13px] text-muted-foreground">
            Their current pay is filled in below. Saving replaces it from the effective date.
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="base-salary">Monthly base salary</Label>
          <Input
            id="base-salary"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value.baseSalary}
            onChange={(event) => set({ baseSalary: event.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effective-from">Effective from</Label>
          <Input
            id="effective-from"
            type="date"
            value={value.effectiveFrom}
            onChange={(event) => set({ effectiveFrom: event.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="allowance-amount">Monthly allowances</Label>
          <Input
            id="allowance-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value.allowanceAmount}
            onChange={(event) => set({ allowanceAmount: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deduction-amount">Fixed monthly deductions</Label>
          <Input
            id="deduction-amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={value.deductionAmount}
            onChange={(event) => set({ deductionAmount: event.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="compensation-notes">Notes</Label>
        <Input
          id="compensation-notes"
          value={value.notes}
          onChange={(event) => set({ notes: event.target.value })}
          placeholder="Optional"
        />
      </div>
      <Button type="submit" disabled={saving || employees.length === 0}>
        {saving ? 'Saving…' : 'Save compensation'}
      </Button>
    </form>
  )
}

/* ---------- Process pre-flight ---------- */

export function ProcessPayrollDialog({
  period,
  open,
  onOpenChange,
  employees,
  compensations,
  busy,
  onConfirm,
}: {
  period: PayrollPeriod | null
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: PayrollEmployee[]
  compensations: CompensationProfile[]
  busy: boolean
  onConfirm: () => void
}) {
  const { data, loading, error } = useQuery<{ payrollPeriodPreview: PayrollPreview }>(
    PAYROLL_PERIOD_PREVIEW_QUERY,
    {
      variables: { payrollPeriodId: period?.id ?? '' },
      skip: !open || !period,
      fetchPolicy: 'no-cache',
      errorPolicy: 'none',
    },
  )

  const usingFallback = Boolean(error && isSchemaMismatch(error))
  const preview: PayrollPreview | null =
    data?.payrollPeriodPreview ??
    (usingFallback && period ? buildLocalPreview(period.periodMonth, employees, compensations) : null)
  const monthLabel = period ? formatMonth(period.periodMonth) : ''
  const payable = preview ? preview.employeeCount - preview.missingCompensationCount : 0

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Process ${monthLabel} payroll?`}
      description="Payslips are generated for everyone listed below. You can still delete the period before marking it as paid."
      confirmLabel="Process payroll"
      busy={busy}
      confirmDisabled={loading || !preview || payable <= 0}
      onConfirm={onConfirm}
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking employees and compensation…
        </p>
      ) : null}

      {error && !usingFallback ? (
        <Notice tone="danger">{readableError(error)}</Notice>
      ) : null}

      {preview ? (
        <>
          <dl className="app-muted-surface grid grid-cols-2 gap-x-4 gap-y-3 p-4">
            <div>
              <dt className="text-[13px] text-muted-foreground">Payslips to generate</dt>
              <dd className="text-base font-semibold tabular-nums">{plural(payable, 'employee')}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Missing compensation</dt>
              <dd className="text-base font-semibold tabular-nums">
                {preview.missingCompensationCount === 0 ? 'None' : plural(preview.missingCompensationCount, 'employee')}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Estimated gross</dt>
              <dd className="text-base font-semibold tabular-nums">
                {formatMoney(preview.estimatedGross, preview.currencyCode)}
              </dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted-foreground">Estimated net</dt>
              <dd className="text-base font-semibold tabular-nums">
                {formatMoney(preview.estimatedNet, preview.currencyCode)}
              </dd>
            </div>
          </dl>

          {preview.missingCompensationCount > 0 ? (
            <Notice tone="warning">
              <p className="font-semibold">
                {plural(preview.missingCompensationCount, 'employee')} will not get a payslip
              </p>
              <p className="mt-1">
                {preview.missingCompensationNames.slice(0, 8).join(', ')}
                {preview.missingCompensationNames.length > 8
                  ? ` and ${preview.missingCompensationNames.length - 8} more`
                  : ''}
                . Add their compensation first if they should be paid this month.
              </p>
            </Notice>
          ) : null}

          {preview.warnings.map((warning) => (
            <Notice key={warning} tone="warning">
              {warning}
            </Notice>
          ))}

          {usingFallback ? (
            <p className="text-[13px] leading-5 text-muted-foreground">
              Estimate based on current compensation profiles, before proration for join or exit
              dates and unpaid leave.
            </p>
          ) : null}
        </>
      ) : null}
    </ConfirmDialog>
  )
}
