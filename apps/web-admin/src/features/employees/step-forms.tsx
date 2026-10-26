import { Copy, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { SelectField, TextField } from '@/features/shared/controls'
import type { Department, Designation, SiteAssignment, WorkSite } from '@/features/shared/reference-data'
import { formatMoney, formatStatus } from '@/lib/format'

import {
  EMPLOYEE_STATUSES,
  EMPLOYMENT_TYPES,
  type PayForm,
  type Person,
  type ProfileForm,
  type SignInForm,
  type SiteForm,
} from './types'
import { generatePassword, type ProfileErrors } from './mutations'

/* ----------------------------------------------------------------------------
 * Field groups
 * ------------------------------------------------------------------------- */

export function ProfileFields({
  form,
  onChange,
  departments,
  designations,
  people,
  editingId,
  showStatus,
  errors = {},
}: {
  errors?: ProfileErrors
  form: ProfileForm
  onChange: (patch: Partial<ProfileForm>) => void
  departments: Department[]
  designations: Designation[]
  people: Person[]
  editingId?: string | null
  showStatus?: boolean
}) {
  const departmentOptions = departments
    .filter((d) => d.isActive || d.id === form.departmentId)
    .map((d) => ({ value: d.id, label: d.name }))
  const designationOptions = designations
    .filter((d) => d.departmentId === form.departmentId && (d.isActive || d.id === form.designationId))
    .map((d) => ({ value: d.id, label: d.title }))
  const supervisorOptions = people
    .filter((p) => p.isActive && p.id !== editingId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((p) => ({ value: p.id, label: `${p.fullName} · ${p.designation.title}` }))

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField error={errors.firstName} id="profile-first-name" label="First name">
          <Input aria-invalid={errors.firstName ? true : undefined} autoComplete="off" id="profile-first-name" onChange={(e) => onChange({ firstName: e.target.value })} required value={form.firstName} />
        </TextField>
        <TextField error={errors.lastName} id="profile-last-name" label="Last name">
          <Input aria-invalid={errors.lastName ? true : undefined} autoComplete="off" id="profile-last-name" onChange={(e) => onChange({ lastName: e.target.value })} required value={form.lastName} />
        </TextField>
        <TextField error={errors.email} hint={errors.email ? undefined : 'Used for sign-in if you create one.'} id="profile-email" label="Work email">
          <Input aria-invalid={errors.email ? true : undefined} autoComplete="off" id="profile-email" onChange={(e) => onChange({ email: e.target.value })} required type="email" value={form.email} />
        </TextField>
        <TextField id="profile-phone" label="Phone" optional>
          <Input autoComplete="off" id="profile-phone" onChange={(e) => onChange({ phone: e.target.value })} type="tel" value={form.phone} />
        </TextField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          error={errors.departmentId}
          id="profile-department"
          label="Department"
          onChange={(departmentId) => onChange({ departmentId, designationId: '' })}
          options={departmentOptions}
          placeholder="Choose a department"
          required
          value={form.departmentId}
        />
        <SelectField
          disabled={!form.departmentId}
          hint={
            form.departmentId && designationOptions.length === 0 ? (
              <>
                No designations in this department yet.{' '}
                <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/organisation#designations">
                  Add one in Organisation
                </Link>
              </>
            ) : undefined
          }
          error={errors.designationId}
          id="profile-designation"
          label="Designation"
          onChange={(designationId) => onChange({ designationId })}
          options={designationOptions}
          placeholder={form.departmentId ? 'Choose a designation' : 'Choose a department first'}
          required
          value={form.designationId}
        />
        <SelectField
          id="profile-supervisor"
          label="Supervisor"
          noneLabel="No supervisor"
          onChange={(supervisorId) => onChange({ supervisorId })}
          options={supervisorOptions}
          value={form.supervisorId}
        />
        <SelectField
          id="profile-employment-type"
          label="Employment type"
          onChange={(employmentType) => onChange({ employmentType })}
          options={EMPLOYMENT_TYPES.map((value) => ({ value, label: formatStatus(value) }))}
          value={form.employmentType}
        />
        <TextField error={errors.joinDate} id="profile-join-date" label="Join date">
          <Input aria-invalid={errors.joinDate ? true : undefined} id="profile-join-date" onChange={(e) => onChange({ joinDate: e.target.value })} required type="date" value={form.joinDate} />
        </TextField>
        {showStatus ? (
          <SelectField
            hint="Inactive people lose sign-in access and leave payroll."
            id="profile-status"
            label="Status"
            onChange={(status) => onChange({ status })}
            options={EMPLOYEE_STATUSES.map((value) => ({ value, label: formatStatus(value) }))}
            value={form.status}
          />
        ) : null}
      </div>
    </div>
  )
}

export function PayFields({ form, onChange }: { form: PayForm; onChange: (patch: Partial<PayForm>) => void }) {
  const base = Number.parseFloat(form.baseSalary) || 0
  const allowance = Number.parseFloat(form.allowanceAmount) || 0
  const deduction = Number.parseFloat(form.deductionAmount) || 0
  const currency = /^[A-Za-z]{3}$/.test(form.currencyCode) ? form.currencyCode.toUpperCase() : 'AED'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField hint="Monthly, before allowances." id="pay-base" label="Base salary">
          <Input id="pay-base" inputMode="decimal" min={0} onChange={(e) => onChange({ baseSalary: e.target.value })} step="0.01" type="number" value={form.baseSalary} />
        </TextField>
        <TextField id="pay-allowance" label="Allowance" optional>
          <Input id="pay-allowance" inputMode="decimal" min={0} onChange={(e) => onChange({ allowanceAmount: e.target.value })} step="0.01" type="number" value={form.allowanceAmount} />
        </TextField>
        <TextField id="pay-deduction" label="Monthly deductions" optional>
          <Input id="pay-deduction" inputMode="decimal" min={0} onChange={(e) => onChange({ deductionAmount: e.target.value })} step="0.01" type="number" value={form.deductionAmount} />
        </TextField>
        <TextField hint="Defaults to the company currency." id="pay-currency" label="Currency">
          <Input id="pay-currency" maxLength={3} onChange={(e) => onChange({ currencyCode: e.target.value.toUpperCase() })} value={form.currencyCode} />
        </TextField>
        <TextField id="pay-effective" label="Effective from">
          <Input id="pay-effective" onChange={(e) => onChange({ effectiveFrom: e.target.value })} type="date" value={form.effectiveFrom} />
        </TextField>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-4 py-3 text-sm">
        <span className="text-muted-foreground">Monthly pay after deductions</span>
        <span className="font-semibold tabular-nums text-foreground">{formatMoney(base + allowance - deduction, currency)}</span>
      </div>
    </div>
  )
}

export function SiteFields({
  form,
  onChange,
  sites,
  current,
}: {
  form: SiteForm
  onChange: (patch: Partial<SiteForm>) => void
  sites: WorkSite[]
  current?: SiteAssignment[]
}) {
  const activeSites = sites.filter((site) => site.isActive)
  if (activeSites.length === 0) {
    return (
      <Notice tone="info">
        No work sites exist yet.{' '}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/organisation#sites">
          Add one in Organisation
        </Link>
        , then assign it from the row menu.
      </Notice>
    )
  }
  return (
    <div className="space-y-4">
      {current && current.length > 0 ? (
        <div className="rounded-xl border border-border/70 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Currently assigned</p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {current.map((assignment) => (
              <li key={assignment.id}>
                {assignment.location.name}
                {assignment.isPrimary ? ' · primary' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <SelectField
        hint="Attendance can only be recorded at sites a person is assigned to."
        id="site-location"
        label="Work site"
        onChange={(locationId) => onChange({ locationId })}
        options={activeSites.map((site) => ({
          value: site.id,
          label: site.city ? `${site.name} · ${site.city}` : site.name,
        }))}
        placeholder="Choose a work site"
        value={form.locationId}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          checked={form.isPrimary}
          className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          onChange={(e) => onChange({ isPrimary: e.target.checked })}
          type="checkbox"
        />
        <span>
          <span className="font-medium text-foreground">Make this their primary site</span>
          <span className="block text-muted-foreground">Used as the default when recording attendance.</span>
        </span>
      </label>
    </div>
  )
}


export function SignInFields({
  form,
  onChange,
  person,
  grantable,
  onRevoke,
  revoking = null,
}: {
  form: SignInForm
  onChange: (patch: Partial<SignInForm>) => void
  person: Pick<Person, 'email' | 'hasLinkedAccount' | 'linkedAccountEmail' | 'linkedAccountRoles'> | null
  grantable: string[]
  // Present only for viewers allowed to revoke (ADMIN); EMPLOYEE is never removable.
  onRevoke?: (role: string) => void
  revoking?: string | null
}) {
  const [copied, setCopied] = useState(false)
  const hasAccount = Boolean(person?.hasLinkedAccount)
  const needsPassword = !hasAccount && (form.createSignIn || Boolean(form.staffRole))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(form.password)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-4">
      {hasAccount ? (
        <section aria-labelledby="current-access-heading" className="rounded-xl border border-border/70 bg-secondary/40 p-3.5" data-testid="current-access">
          <h3 className="text-sm font-semibold text-foreground" id="current-access-heading">
            Current access
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Signs in as <span className="font-medium text-foreground">{person?.linkedAccountEmail ?? person?.email}</span>
          </p>
          <ul aria-label="Current roles" className="mt-2.5 divide-y divide-border/70 rounded-lg border border-border/70 bg-card">
            {(person?.linkedAccountRoles.length ? person.linkedAccountRoles : ['EMPLOYEE']).map((role) => (
              <li className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-sm" data-role={role} key={role}>
                <span className="font-medium text-foreground">{formatStatus(role)}</span>
                {onRevoke && role !== 'EMPLOYEE' ? (
                  <Button
                    aria-label={`Remove ${formatStatus(role)} role`}
                    disabled={revoking !== null}
                    onClick={() => onRevoke(role)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    {revoking === role ? 'Removing…' : 'Remove'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <label className="flex items-start gap-3 text-sm">
          <input
            checked={form.createSignIn || Boolean(form.staffRole)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
            disabled={Boolean(form.staffRole)}
            onChange={(e) =>
              onChange({ createSignIn: e.target.checked, password: e.target.checked && !form.password ? generatePassword() : form.password })
            }
            type="checkbox"
          />
          <span>
            <span className="font-medium text-foreground">Create a sign-in for the employee app</span>
            <span className="block text-muted-foreground">
              They sign in with {person?.email ? <span className="font-medium">{person.email}</span> : 'their work email'} and a temporary password you share with them.
            </span>
          </span>
        </label>
      )}

      {needsPassword ? (
        <TextField hint="At least 8 characters. Share it privately; they can change it after signing in." id="signin-password" label="Temporary password">
          <div className="flex gap-2">
            <Input autoComplete="new-password" className="font-mono" id="signin-password" onChange={(e) => onChange({ password: e.target.value })} value={form.password} />
            <Button aria-label="Generate a new password" onClick={() => onChange({ password: generatePassword() })} size="icon" title="Generate" type="button" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button aria-label="Copy password" disabled={!form.password} onClick={() => void copy()} size="icon" title={copied ? 'Copied' : 'Copy'} type="button" variant="outline">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </TextField>
      ) : null}

      {grantable.length > 0 ? (
        <SelectField
          hint="Staff roles open the admin panel with the matching permissions."
          id="signin-staff-role"
          label="Staff role"
          noneLabel="None — employee app only"
          onChange={(staffRole) =>
            onChange({ staffRole, password: staffRole && !hasAccount && !form.password ? generatePassword() : form.password })
          }
          options={grantable.map((role) => ({ value: role, label: formatStatus(role) }))}
          value={form.staffRole}
        />
      ) : null}
    </div>
  )
}
