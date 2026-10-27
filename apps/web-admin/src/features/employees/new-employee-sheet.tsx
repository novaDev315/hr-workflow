import { CheckCircle2, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { readableError } from '@/lib/graphql-errors'
import type { Department, Designation, WorkSite } from '@/features/shared/reference-data'
import { FormDialog } from '@/features/shared/form-dialog'
import { StepIndicator, type StepState } from '@/features/shared/step-indicator'
import { formatStatus } from '@/lib/format'

import {
  PayFields,
  ProfileFields,
  SignInFields,
  SiteFields,
} from './step-forms'
import {
  useEmployeeMutations,
  validatePay,
  focusFirstProfileError,
  profileFieldErrors,
  validateProfile,
  validateSignIn,
  type ProfileErrors,
} from './mutations'
import {
  emptyPay,
  emptyProfile,
  type PayForm,
  type Person,
  type ProfileForm,
  type SignInForm,
  type SiteForm,
} from './types'

const STEPS = ['Profile', 'Pay', 'Work site', 'Sign-in'] as const
type Outcome = 'done' | 'skipped' | null

const STEP_HELP = [
  'Who they are and where they sit in the organisation. Saving this step adds them to People.',
  'Their monthly pay. Payroll uses this from the effective date.',
  'Where they clock in. You can add more sites later.',
  'Optional access to the employee app and, for staff, the admin panel.',
]

export function NewEmployeeSheet({
  open,
  onOpenChange,
  departments,
  designations,
  people,
  sites,
  currencyCode,
  grantable,
  onFinished,
  initialProfile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departments: Department[]
  designations: Designation[]
  people: Person[]
  sites: WorkSite[]
  currencyCode: string
  grantable: string[]
  onFinished: (summary: string) => void
  /** Prefill for the profile step, e.g. a candidate who was just hired. */
  initialProfile?: Partial<ProfileForm> | null
}) {
  const mutations = useEmployeeMutations()
  const [step, setStep] = useState(0)
  const [outcomes, setOutcomes] = useState<Outcome[]>([null, null, null, null])
  const [employee, setEmployee] = useState<{ id: string; name: string; email: string } | null>(null)
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [pay, setPay] = useState<PayForm>(() => emptyPay(currencyCode))
  const [site, setSite] = useState<SiteForm>({ locationId: '', isPrimary: true })
  const [signIn, setSignIn] = useState<SignInForm>({ createSignIn: false, password: '', staffRole: '' })
  const [error, setError] = useState<string | null>(null)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setOutcomes([null, null, null, null])
    setEmployee(null)
    setProfile({ ...emptyProfile(), ...(initialProfile ?? {}) })
    setPay(emptyPay(currencyCode))
    const activeSites = sites.filter((s) => s.isActive)
    setSite({ locationId: activeSites.length === 1 ? activeSites[0].id : '', isPrimary: true })
    setSignIn({ createSignIn: false, password: '', staffRole: '' })
    setError(null)
    setProfileErrors({})
    setFinished(false)
    // Reset only when the drawer opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Company currency may load after the drawer opens.
  useEffect(() => {
    setPay((current) => (current.baseSalary ? current : { ...current, currencyCode }))
  }, [currencyCode])

  // Pay starts from the join date unless the admin changes it.
  useEffect(() => {
    setPay((current) => ({ ...current, effectiveFrom: profile.joinDate || current.effectiveFrom }))
  }, [profile.joinDate])

  const markAndAdvance = (index: number, outcome: Outcome) => {
    setOutcomes((current) => current.map((value, i) => (i === index ? outcome : value)))
    setError(null)
    if (index === STEPS.length - 1) {
      setFinished(true)
    } else {
      setStep(index + 1)
    }
  }

  const runStep = async () => {
    setError(null)
    if (step === 0) {
      const fieldErrors = profileFieldErrors(profile)
      setProfileErrors(fieldErrors)
      if (Object.keys(fieldErrors).length > 0) {
        focusFirstProfileError(fieldErrors)
        return
      }
    }
    const validation =
      step === 0
        ? validateProfile(profile)
        : step === 1
          ? validatePay(pay)
          : step === 2
            ? site.locationId
              ? null
              : 'Choose a work site, or skip this step.'
            : validateSignIn(signIn, false)
    if (validation) {
      setError(validation)
      return
    }

    setBusy(true)
    try {
      if (step === 0) {
        const id = await mutations.saveProfile(profile, employee?.id)
        setEmployee({ id, name: `${profile.firstName.trim()} ${profile.lastName.trim()}`, email: profile.email.trim() })
      } else if (!employee) {
        return
      } else if (step === 1) {
        await mutations.savePay(employee.id, pay)
      } else if (step === 2) {
        await mutations.saveSite(employee.id, site)
      } else if (step === 3) {
        if (!signIn.createSignIn && !signIn.staffRole) {
          markAndAdvance(3, 'skipped')
          return
        }
        await mutations.saveSignIn(employee.id, signIn, false)
      }
      markAndAdvance(step, 'done')
    } catch (mutationError) {
      setError(readableError(mutationError, 'This step could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  const summary = () => {
    const name = employee?.name ?? 'The employee'
    const done = STEPS.filter((_, i) => i > 0 && outcomes[i] === 'done').map((label) => label.toLowerCase())
    const pending = STEPS.filter((_, i) => i > 0 && outcomes[i] !== 'done').map((label) => label.toLowerCase())
    let text = `${name} was added.`
    if (done.length) text += ` Set up: ${done.join(', ')}.`
    if (pending.length) text += ` Still to do from the row menu: ${pending.join(', ')}.`
    return text
  }

  const close = () => {
    if (employee) onFinished(summary())
    onOpenChange(false)
  }

  const stepStates: { label: string; state: StepState }[] = STEPS.map((label, index) => ({
    label,
    state: finished
      ? outcomes[index] === 'done'
        ? 'done'
        : 'skipped'
      : index === step
        ? 'current'
        : outcomes[index] === 'done'
          ? 'done'
          : outcomes[index] === 'skipped'
            ? 'skipped'
            : 'upcoming',
  }))

  const laterStepFailed = Boolean(error && employee && step > 0)
  const isLast = step === STEPS.length - 1

  const footer = finished ? (
    <div className="flex justify-end">
      <Button onClick={close} type="button">
        Done
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {step > 0 ? (
          <Button disabled={busy} onClick={() => { setError(null); setStep(step - 1) }} type="button" variant="ghost">
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {employee && step > 0 ? (
          <Button disabled={busy} onClick={close} type="button" variant="ghost">
            Finish later
          </Button>
        ) : null}
        {step > 0 ? (
          <Button disabled={busy} onClick={() => markAndAdvance(step, 'skipped')} type="button" variant="outline">
            Skip
          </Button>
        ) : null}
        <Button disabled={busy} form="new-employee-step" type="submit">
          {busy ? 'Saving…' : laterStepFailed ? 'Try again' : step === 0 ? (employee ? 'Save and continue' : 'Add and continue') : isLast ? 'Finish' : 'Continue'}
        </Button>
      </div>
    </div>
  )

  return (
    <FormDialog
      description={finished ? undefined : STEP_HELP[step]}
      footer={footer}
      header={<StepIndicator steps={stepStates} />}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
      open={open}
      title={finished ? 'Employee added' : employee ? `New employee · ${employee.name}` : 'New employee'}
    >
      {finished ? (
        <FinishedSummary
          email={employee?.email ?? ''}
          name={employee?.name ?? ''}
          outcomes={outcomes}
          password={signIn.createSignIn || signIn.staffRole ? signIn.password : ''}
          role={signIn.staffRole}
        />
      ) : (
        <form
          className="space-y-5"
          id="new-employee-step"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            void runStep()
          }}
        >
          {laterStepFailed ? (
            <Notice tone="warning">
              <p>
                <span className="font-semibold">{employee?.name} is already saved,</span> but this step did not
                go through:
              </p>
              <p className="mt-1 font-medium">{error}</p>
              <p className="mt-1">Fix it and try again, skip it, or finish later from the row menu.</p>
            </Notice>
          ) : error ? (
            <Notice role="alert" tone="danger">{error}</Notice>
          ) : null}

          {step === 0 ? (
            <ProfileFields
              departments={departments}
              designations={designations}
              editingId={employee?.id}
              form={profile}
              errors={profileErrors}
              onChange={(patch) => {
                setProfile((current) => ({ ...current, ...patch }))
                setProfileErrors((current) => {
                  const next = { ...current }
                  for (const key of Object.keys(patch) as (keyof ProfileForm)[]) delete next[key]
                  return next
                })
              }}
              people={people}
            />
          ) : null}
          {step === 1 ? <PayFields form={pay} onChange={(patch) => setPay((current) => ({ ...current, ...patch }))} /> : null}
          {step === 2 ? (
            <SiteFields form={site} onChange={(patch) => setSite((current) => ({ ...current, ...patch }))} sites={sites} />
          ) : null}
          {step === 3 ? (
            <SignInFields
              form={signIn}
              grantable={grantable}
              onChange={(patch) => setSignIn((current) => ({ ...current, ...patch }))}
              person={employee ? { email: employee.email, hasLinkedAccount: false, linkedAccountEmail: null, linkedAccountRoles: [] } : null}
            />
          ) : null}
        </form>
      )}
    </FormDialog>
  )
}

function FinishedSummary({
  name,
  email,
  outcomes,
  password,
  role,
}: {
  name: string
  email: string
  outcomes: Outcome[]
  password: string
  role: string
}) {
  const [copied, setCopied] = useState(false)
  const rows = [
    { label: 'Profile', done: outcomes[0] === 'done', detail: 'Added to People' },
    { label: 'Pay', done: outcomes[1] === 'done', detail: outcomes[1] === 'done' ? 'Pay set up' : 'Not set up yet' },
    { label: 'Work site', done: outcomes[2] === 'done', detail: outcomes[2] === 'done' ? 'Site assigned' : 'No site yet' },
    {
      label: 'Sign-in',
      done: outcomes[3] === 'done',
      detail: outcomes[3] === 'done' ? (role ? `Sign-in created · ${formatStatus(role)}` : 'Sign-in created') : 'No sign-in yet',
    },
  ]
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        <p className="text-sm leading-6 text-foreground">
          <span className="font-semibold">{name}</span> is now in People.
          {rows.some((row) => !row.done) ? ' Anything skipped can be finished from their row menu.' : ''}
        </p>
      </div>
      <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
        {rows.map((row) => (
          <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm" key={row.label}>
            <span className="font-medium text-foreground">{row.label}</span>
            <span className={row.done ? 'text-foreground' : 'text-muted-foreground'}>{row.detail}</span>
          </li>
        ))}
      </ul>
      {outcomes[3] === 'done' && password ? (
        <div className="rounded-xl bg-secondary/60 p-4 text-sm">
          <p className="font-medium text-foreground">Share these sign-in details privately</p>
          <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="truncate">{email}</dd>
            <dt className="text-muted-foreground">Temporary password</dt>
            <dd className="flex items-center gap-2 font-mono">
              {password}
              <button
                aria-label="Copy password"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard?.writeText(password).then(() => setCopied(true)).catch(() => setCopied(false))
                }}
                type="button"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              {copied ? <span className="font-sans text-xs text-muted-foreground">Copied</span> : null}
            </dd>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
