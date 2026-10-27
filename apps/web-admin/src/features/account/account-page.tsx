import { gql, useMutation, useQuery } from '@apollo/client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { ChangePasswordSheet } from '@/components/layouts/change-password-sheet'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { TextField } from '@/features/shared/controls'
import { PageIntro } from '@/features/shared/page-intro'
import { SideSheet } from '@/features/shared/side-sheet'
import { persistAdminSession, readAuthToken, useAdminSession } from '@/lib/auth-session'
import { formatStatus } from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'
import { toast } from '@/lib/toast'

const ACCOUNT_FIELDS = `
  id
  email
  firstName
  lastName
  fullName
  roles
  canAccessAdminPanel
  canManageAccounts
  isActive
`

const ME_QUERY = gql`
  query AccountSettingsMe {
    me {
      ${ACCOUNT_FIELDS}
      employeeId
      employeeNumber
      departmentName
      designationTitle
    }
  }
`

const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateMyProfile($input: UpdateMyProfileInput!) {
    updateMyProfile(input: $input) {
      ${ACCOUNT_FIELDS}
    }
  }
`

const CHANGE_EMAIL_MUTATION = gql`
  mutation ChangeMyEmail($input: ChangeMyEmailInput!) {
    changeMyEmail(input: $input) {
      accessToken
      account {
        ${ACCOUNT_FIELDS}
      }
    }
  }
`

const SIGN_OUT_OTHERS_MUTATION = gql`
  mutation SignOutOtherSessions($input: SignOutOtherSessionsInput!) {
    signOutOtherSessions(input: $input) {
      accessToken
      account {
        ${ACCOUNT_FIELDS}
      }
    }
  }
`

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Sheet = 'name' | 'email' | 'password' | 'devices' | null

// Focus after render so the field's error is announced with it.
const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

function initialsOf(fullName: string) {
  return (
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  )
}

export function AccountPage() {
  const { account } = useAdminSession()
  const me = useQuery(ME_QUERY, { fetchPolicy: 'network-only' })
  const [sheet, setSheet] = useState<Sheet>(null)
  const profile = me.data?.me
  const linked = Boolean(profile?.employeeId)

  if (!account) return null

  const roles = account.roles.length ? account.roles.map(formatStatus).join(', ') : formatStatus('ADMIN')
  const employeeLine = linked
    ? [profile?.employeeNumber, profile?.designationTitle, profile?.departmentName].filter(Boolean).join(' · ')
    : null
  const closeSheet = (open: boolean) => {
    if (!open) setSheet(null)
  }

  return (
    <div className="max-w-[760px] space-y-5">
      <PageIntro title="Account settings" description="How you appear in the workspace and how you sign in." />

      {me.error ? (
        <Notice tone="danger">{readableError(me.error, 'Your account details could not be loaded.')}</Notice>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 border-b border-border/70 p-4 sm:p-6">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary"
          >
            {initialsOf(account.fullName)}
          </span>
          <div className="min-w-0">
            <p className="app-editorial truncate text-[1.45rem] leading-tight text-foreground">{account.fullName}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {account.email} · {roles}
            </p>
            {employeeLine ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{employeeLine}</p> : null}
          </div>
        </div>

        <ul aria-label="Account settings" className="divide-y divide-border/70">
          <SettingRow
            action={
              linked ? null : (
                <Button disabled={me.loading} onClick={() => setSheet('name')} size="sm" type="button" variant="outline">
                  Edit
                </Button>
              )
            }
            hint={linked ? 'Comes from your employee record. HR can change it in People.' : undefined}
            label="Name"
            value={account.fullName}
          />
          <SettingRow
            action={
              <Button onClick={() => setSheet('email')} size="sm" type="button" variant="outline">
                Change
              </Button>
            }
            label="Sign-in email"
            value={account.email}
          />
          <SettingRow
            action={
              <Button onClick={() => setSheet('password')} size="sm" type="button" variant="outline">
                Change
              </Button>
            }
            label="Password"
            value={<span aria-label="Hidden">••••••••</span>}
          />
          <SettingRow
            action={
              <Button onClick={() => setSheet('devices')} size="sm" type="button" variant="outline">
                Sign out
              </Button>
            }
            label="Other devices"
            value="Sign out everywhere except this browser"
          />
        </ul>
      </Card>

      <NameSheet
        firstName={profile?.firstName ?? account.firstName}
        lastName={profile?.lastName ?? account.lastName}
        onOpenChange={closeSheet}
        open={sheet === 'name'}
      />
      <EmailSheet currentEmail={account.email} onOpenChange={closeSheet} open={sheet === 'email'} />
      <ChangePasswordSheet onOpenChange={closeSheet} open={sheet === 'password'} />
      <SignOutOthersSheet onOpenChange={closeSheet} open={sheet === 'devices'} />
    </div>
  )
}

function SettingRow({
  label,
  value,
  hint,
  action,
}: {
  label: string
  value: ReactNode
  hint?: string
  action: ReactNode
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-4 sm:grid-cols-[168px_minmax(0,1fr)_auto] sm:px-6">
      <p className="text-sm font-semibold text-foreground sm:row-span-2 sm:self-start sm:pt-0.5">{label}</p>
      <div className="col-start-1 min-w-0 sm:col-start-2 sm:row-start-1">
        <p className="break-words text-sm text-foreground">{value}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="col-start-2 row-span-2 row-start-1 self-center sm:col-start-3">{action}</div>
    </li>
  )
}

function SheetFooter({ formId, busy, busyLabel, label, onCancel }: {
  formId: string
  busy: boolean
  busyLabel: string
  label: string
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button disabled={busy} onClick={onCancel} type="button" variant="outline">
        Cancel
      </Button>
      <Button disabled={busy} form={formId} type="submit">
        {busy ? busyLabel : label}
      </Button>
    </div>
  )
}

function NameSheet({
  open,
  onOpenChange,
  firstName,
  lastName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  firstName: string
  lastName: string
}) {
  const [form, setForm] = useState({ firstName, lastName })
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [save, { loading }] = useMutation(UPDATE_PROFILE_MUTATION)

  useEffect(() => {
    if (!open) return
    setForm({ firstName, lastName })
    setErrors({})
    setError(null)
  }, [open, firstName, lastName])

  const close = (next: boolean) => {
    if (!next && loading) return
    onOpenChange(next)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const next = {
      firstName: form.firstName.trim() ? undefined : 'Enter your first name.',
      lastName: form.lastName.trim() ? undefined : 'Enter your last name.',
    }
    setErrors(next)
    if (next.firstName) return focusField('account-first-name')
    if (next.lastName) return focusField('account-last-name')

    try {
      const result = await save({
        variables: { input: { firstName: form.firstName.trim(), lastName: form.lastName.trim() } },
      })
      const account = result.data?.updateMyProfile
      const token = readAuthToken()
      if (!account || !token) throw new Error('Your name could not be saved. Please try again.')
      persistAdminSession({ accessToken: token, account })
      toast.success('Name saved.')
      onOpenChange(false)
    } catch (mutationError) {
      setError(readableError(mutationError, 'Your name could not be saved.'))
    }
  }

  return (
    <SideSheet
      description="How your name appears in the workspace."
      footer={<SheetFooter busy={loading} busyLabel="Saving…" formId="account-name-form" label="Save name" onCancel={() => close(false)} />}
      onOpenChange={close}
      open={open}
      title="Edit name"
    >
      <form className="space-y-5" id="account-name-form" noValidate onSubmit={submit}>
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
        <fieldset className="grid gap-4 sm:grid-cols-2" disabled={loading}>
          <TextField error={errors.firstName} id="account-first-name" label="First name">
            <Input
              aria-invalid={errors.firstName ? true : undefined}
              autoComplete="given-name"
              id="account-first-name"
              maxLength={60}
              onChange={(event) => {
                setForm((current) => ({ ...current, firstName: event.target.value }))
                setErrors((current) => ({ ...current, firstName: undefined }))
              }}
              value={form.firstName}
            />
          </TextField>
          <TextField error={errors.lastName} id="account-last-name" label="Last name">
            <Input
              aria-invalid={errors.lastName ? true : undefined}
              autoComplete="family-name"
              id="account-last-name"
              maxLength={60}
              onChange={(event) => {
                setForm((current) => ({ ...current, lastName: event.target.value }))
                setErrors((current) => ({ ...current, lastName: undefined }))
              }}
              value={form.lastName}
            />
          </TextField>
        </fieldset>
      </form>
    </SideSheet>
  )
}

function EmailSheet({
  open,
  onOpenChange,
  currentEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentEmail: string
}) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [changeEmail, { loading }] = useMutation(CHANGE_EMAIL_MUTATION)

  useEffect(() => {
    if (!open) return
    setForm({ email: '', password: '' })
    setErrors({})
    setError(null)
  }, [open])

  const close = (next: boolean) => {
    if (!next && loading) return
    onOpenChange(next)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const email = form.email.trim().toLowerCase()
    const next = {
      email: !email
        ? 'Enter the new email.'
        : !EMAIL_PATTERN.test(email)
          ? 'Enter a valid email, like name@company.com.'
          : email === currentEmail.toLowerCase()
            ? 'This is already your sign-in email.'
            : undefined,
      password: form.password ? undefined : 'Enter your current password.',
    }
    setErrors(next)
    if (next.email) return focusField('account-new-email')
    if (next.password) return focusField('account-email-password')

    try {
      const result = await changeEmail({ variables: { input: { newEmail: email, currentPassword: form.password } } })
      const payload = result.data?.changeMyEmail
      if (!payload?.accessToken) throw new Error('Your email could not be changed. Please try again.')
      persistAdminSession(payload)
      toast.success('Sign-in email changed. Other devices were signed out.')
      onOpenChange(false)
    } catch (mutationError) {
      const message = readableError(mutationError, 'Your email could not be changed.')
      if (/current password is incorrect/i.test(message)) {
        setErrors({ password: 'That is not your current password.' })
        focusField('account-email-password')
      } else if (/can't be used/i.test(message)) {
        setErrors({ email: message })
        focusField('account-new-email')
      } else {
        setError(message)
      }
    }
  }

  return (
    <SideSheet
      description={
        <>
          You sign in with <span className="font-medium text-foreground">{currentEmail}</span>. After the change you
          stay signed in here and other devices are signed out.
        </>
      }
      footer={<SheetFooter busy={loading} busyLabel="Changing…" formId="account-email-form" label="Change email" onCancel={() => close(false)} />}
      onOpenChange={close}
      open={open}
      title="Change sign-in email"
    >
      <form className="space-y-5" id="account-email-form" noValidate onSubmit={submit}>
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
        <fieldset className="grid gap-4" disabled={loading}>
          <TextField error={errors.email} id="account-new-email" label="New email">
            <Input
              aria-invalid={errors.email ? true : undefined}
              autoComplete="email"
              id="account-new-email"
              maxLength={254}
              onChange={(event) => {
                setForm((current) => ({ ...current, email: event.target.value }))
                setErrors((current) => ({ ...current, email: undefined }))
              }}
              type="email"
              value={form.email}
            />
          </TextField>
          <TextField error={errors.password} id="account-email-password" label="Current password">
            <Input
              aria-invalid={errors.password ? true : undefined}
              autoComplete="current-password"
              id="account-email-password"
              onChange={(event) => {
                setForm((current) => ({ ...current, password: event.target.value }))
                setErrors((current) => ({ ...current, password: undefined }))
              }}
              type="password"
              value={form.password}
            />
          </TextField>
        </fieldset>
      </form>
    </SideSheet>
  )
}

function SignOutOthersSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signOutOthers, { loading }] = useMutation(SIGN_OUT_OTHERS_MUTATION)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setFieldError(null)
    setError(null)
  }, [open])

  const close = (next: boolean) => {
    if (!next && loading) return
    onOpenChange(next)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!password) {
      setFieldError('Enter your current password.')
      return focusField('account-devices-password')
    }
    try {
      const result = await signOutOthers({ variables: { input: { currentPassword: password } } })
      const payload = result.data?.signOutOtherSessions
      if (!payload?.accessToken) throw new Error('Other devices could not be signed out. Please try again.')
      persistAdminSession(payload)
      toast.success('Other devices were signed out.')
      onOpenChange(false)
    } catch (mutationError) {
      const message = readableError(mutationError, 'Other devices could not be signed out.')
      if (/current password is incorrect/i.test(message)) {
        setFieldError('That is not your current password.')
        focusField('account-devices-password')
      } else {
        setError(message)
      }
    }
  }

  return (
    <SideSheet
      description="Every other browser and phone signed in to your account is signed out. You stay signed in here."
      footer={<SheetFooter busy={loading} busyLabel="Signing out…" formId="account-devices-form" label="Sign out other devices" onCancel={() => close(false)} />}
      onOpenChange={close}
      open={open}
      title="Sign out other devices"
    >
      <form className="space-y-5" id="account-devices-form" noValidate onSubmit={submit}>
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
        <TextField error={fieldError} id="account-devices-password" label="Current password">
          <Input
            aria-invalid={fieldError ? true : undefined}
            autoComplete="current-password"
            disabled={loading}
            id="account-devices-password"
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldError(null)
            }}
            type="password"
            value={password}
          />
        </TextField>
      </form>
    </SideSheet>
  )
}
