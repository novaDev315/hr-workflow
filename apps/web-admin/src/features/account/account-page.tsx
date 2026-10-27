import { gql, useMutation, useQuery } from '@apollo/client'
import { KeyRound, Mail, MonitorSmartphone, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { TextField } from '@/features/shared/controls'
import { PageIntro } from '@/features/shared/page-intro'
import { persistAdminSession, readAuthToken, useAdminSession, type StoredAdminAccount } from '@/lib/auth-session'
import { formatStatus } from '@/lib/format'
import { readableError } from '@/lib/graphql-errors'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

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

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
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

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'email', label: 'Sign-in email', icon: Mail },
  { id: 'password', label: 'Password', icon: KeyRound },
  { id: 'devices', label: 'Devices', icon: MonitorSmartphone },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

// Focus after render so the field's error is announced with it.
const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

const isWrongPassword = (message: string) => /current password is incorrect/i.test(message)

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

type Profile = {
  firstName: string
  lastName: string
  employeeId?: string | null
  employeeNumber?: string | null
  departmentName?: string | null
  designationTitle?: string | null
}

// Personal settings: a section menu on the left (a scrolling row on phones)
// and the chosen section's form on the right. The section lives in the URL
// (?section=password) so it survives a reload and can be linked to.
export function AccountPage() {
  const { account } = useAdminSession()
  const me = useQuery(ME_QUERY, { fetchPolicy: 'network-only' })
  const [params] = useSearchParams()
  const requested = params.get('section')
  const section: SectionId = SECTIONS.some((item) => item.id === requested) ? (requested as SectionId) : 'profile'
  const profile: Profile | undefined = me.data?.me

  if (!account) return null

  return (
    <div className="max-w-[1040px] space-y-6">
      <PageIntro title="Account settings" description="How you appear in the workspace and how you sign in." />

      {me.error ? (
        <Notice tone="danger">{readableError(me.error, 'Your account details could not be loaded.')}</Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <nav aria-label="Account settings sections">
          <ul className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap lg:flex-col">
            {SECTIONS.map((item) => {
              const active = item.id === section
              return (
                <li key={item.id}>
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                    replace
                    to={{ search: item.id === 'profile' ? '' : `?section=${item.id}` }}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {section === 'profile' ? <ProfileSection account={account} loading={me.loading} profile={profile} /> : null}
          {section === 'email' ? <EmailSection currentEmail={account.email} /> : null}
          {section === 'password' ? <PasswordSection email={account.email} /> : null}
          {section === 'devices' ? <DevicesSection /> : null}
        </div>
      </div>
    </div>
  )
}

// One section: a titled card with the form, and a footer strip holding a
// short note and the section's action.
function SettingsPanel({
  title,
  description,
  formId,
  onSubmit,
  note,
  action,
  error,
  children,
}: {
  title: string
  description: ReactNode
  formId: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  note?: ReactNode
  action?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <form aria-labelledby={`${formId}-title`} id={formId} noValidate onSubmit={onSubmit}>
        <div className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
          <h2 className="app-editorial text-[1.35rem] leading-tight text-foreground" id={`${formId}-title`}>
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-5 px-4 py-5 sm:px-6">
          {error ? (
            <Notice role="alert" tone="danger">
              {error}
            </Notice>
          ) : null}
          {children}
        </div>
        {note || action ? (
          <div className="flex flex-col gap-3 border-t border-border/70 bg-[rgba(250,249,245,0.96)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="text-xs leading-5 text-muted-foreground">{note}</p>
            {action ? <div className="shrink-0 sm:ml-auto [&>button]:w-full sm:[&>button]:w-auto">{action}</div> : null}
          </div>
        ) : null}
      </form>
    </Card>
  )
}

function ProfileSection({
  account,
  profile,
  loading,
}: {
  account: StoredAdminAccount
  profile?: Profile
  loading: boolean
}) {
  const saved = { firstName: profile?.firstName ?? account.firstName, lastName: profile?.lastName ?? account.lastName }
  const [form, setForm] = useState(saved)
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [save, { loading: saving }] = useMutation(UPDATE_PROFILE_MUTATION)
  const linked = Boolean(profile?.employeeId)
  const roles = account.roles.length ? account.roles.map(formatStatus) : [formatStatus('ADMIN')]
  const employeeLine = linked
    ? [profile?.employeeNumber, profile?.designationTitle, profile?.departmentName].filter(Boolean).join(' · ')
    : null
  const changed = form.firstName.trim() !== saved.firstName || form.lastName.trim() !== saved.lastName

  // Start from the server's copy once it arrives.
  useEffect(() => {
    if (profile) setForm({ firstName: profile.firstName, lastName: profile.lastName })
  }, [profile])

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
      const updated = result.data?.updateMyProfile
      const token = readAuthToken()
      if (!updated || !token) throw new Error('Your name could not be saved. Please try again.')
      persistAdminSession({ accessToken: token, account: updated })
      setForm({ firstName: updated.firstName, lastName: updated.lastName })
      toast.success('Name saved.')
    } catch (mutationError) {
      setError(readableError(mutationError, 'Your name could not be saved.'))
    }
  }

  const nameField = (key: 'firstName' | 'lastName', id: string, label: string, autoComplete: string) => (
    <TextField error={errors[key]} id={id} label={label}>
      <Input
        aria-invalid={errors[key] ? true : undefined}
        autoComplete={autoComplete}
        id={id}
        maxLength={60}
        onChange={(event) => {
          setForm((current) => ({ ...current, [key]: event.target.value }))
          setErrors((current) => ({ ...current, [key]: undefined }))
        }}
        readOnly={linked}
        value={form[key]}
      />
    </TextField>
  )

  return (
    <SettingsPanel
      action={
        linked ? null : (
          <Button disabled={saving || loading || !changed} type="submit">
            {saving ? 'Saving…' : 'Save name'}
          </Button>
        )
      }
      description="How you appear to people in the workspace."
      error={error}
      formId="account-profile-form"
      note={linked ? 'Your name comes from your employee record. HR can change it in People.' : null}
      onSubmit={submit}
      title="Profile"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary"
        >
          {initialsOf(account.fullName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{account.fullName}</p>
          <p className="truncate text-sm text-muted-foreground">{account.email}</p>
          {employeeLine ? <p className="truncate text-sm text-muted-foreground">{employeeLine}</p> : null}
        </div>
        <div className="ml-auto hidden flex-wrap justify-end gap-1.5 sm:flex">
          {roles.map((role) => (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground" key={role}>
              {role}
            </span>
          ))}
        </div>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={saving}>
        {nameField('firstName', 'account-first-name', 'First name', 'given-name')}
        {nameField('lastName', 'account-last-name', 'Last name', 'family-name')}
      </fieldset>
    </SettingsPanel>
  )
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [changeEmail, { loading }] = useMutation(CHANGE_EMAIL_MUTATION)

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
      setForm({ email: '', password: '' })
      toast.success('Sign-in email changed. Other devices were signed out.')
    } catch (mutationError) {
      const message = readableError(mutationError, 'Your email could not be changed.')
      if (isWrongPassword(message)) {
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
    <SettingsPanel
      action={
        <Button disabled={loading} type="submit">
          {loading ? 'Changing…' : 'Change email'}
        </Button>
      }
      description={
        <>
          You sign in with <span className="font-medium text-foreground">{currentEmail}</span>.
        </>
      }
      error={error}
      formId="account-email-form"
      note="You stay signed in here. Other devices are signed out."
      onSubmit={submit}
      title="Sign-in email"
    >
      <fieldset className="grid gap-4 sm:max-w-md" disabled={loading}>
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
    </SettingsPanel>
  )
}

type PasswordForm = { current: string; next: string; confirm: string }
type PasswordErrors = Partial<Record<keyof PasswordForm, string>>

const EMPTY_PASSWORDS: PasswordForm = { current: '', next: '', confirm: '' }

function validatePasswords(form: PasswordForm): PasswordErrors {
  const errors: PasswordErrors = {}
  if (!form.current) errors.current = 'Enter your current password.'
  if (form.next.length < 8) errors.next = 'Use at least 8 characters.'
  else if (new TextEncoder().encode(form.next).length > 72) errors.next = 'Use a shorter password (72 bytes at most).'
  else if (form.next === form.current) errors.next = 'Choose a password different from the current one.'
  if (!errors.next && form.confirm !== form.next) errors.confirm = 'The passwords do not match.'
  return errors
}

function PasswordSection({ email }: { email: string }) {
  const [form, setForm] = useState<PasswordForm>(EMPTY_PASSWORDS)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD_MUTATION)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const fieldErrors = validatePasswords(form)
    setErrors(fieldErrors)
    const first = (['current', 'next', 'confirm'] as const).find((key) => fieldErrors[key])
    if (first) return focusField(`change-password-${first}`)

    try {
      const result = await changePassword({ variables: { input: { currentPassword: form.current, newPassword: form.next } } })
      const payload = result.data?.changePassword
      if (!payload?.accessToken) throw new Error('The password could not be changed. Please try again.')
      persistAdminSession(payload)
      setForm(EMPTY_PASSWORDS)
      toast.success('Password changed. Other devices were signed out.')
    } catch (mutationError) {
      const message = readableError(mutationError, 'The password could not be changed.')
      if (isWrongPassword(message)) {
        setErrors({ current: 'That is not your current password.' })
        focusField('change-password-current')
      } else {
        setError(message)
      }
    }
  }

  const field = (key: keyof PasswordForm, label: string, autoComplete: string, hint?: string) => (
    <TextField error={errors[key]} hint={errors[key] ? undefined : hint} id={`change-password-${key}`} label={label}>
      <Input
        aria-invalid={errors[key] ? true : undefined}
        autoComplete={autoComplete}
        id={`change-password-${key}`}
        onChange={(event) => {
          setForm((current) => ({ ...current, [key]: event.target.value }))
          setErrors((current) => ({ ...current, [key]: undefined }))
        }}
        type="password"
        value={form[key]}
      />
    </TextField>
  )

  return (
    <SettingsPanel
      action={
        <Button disabled={loading} type="submit">
          {loading ? 'Changing…' : 'Change password'}
        </Button>
      }
      description="Choose a new password for signing in."
      error={error}
      formId="change-password-form"
      note="You stay signed in here. Other devices are signed out."
      onSubmit={submit}
      title="Password"
    >
      <fieldset className="grid gap-4 sm:max-w-md" disabled={loading}>
        {/* Lets password managers update the saved sign-in for this account. */}
        <input aria-hidden="true" autoComplete="username" className="sr-only" readOnly tabIndex={-1} type="email" value={email} />
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password', 'At least 8 characters.')}
        {field('confirm', 'Confirm new password', 'new-password')}
      </fieldset>
    </SettingsPanel>
  )
}

function DevicesSection() {
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [signOutOthers, { loading }] = useMutation(SIGN_OUT_OTHERS_MUTATION)

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
      setPassword('')
      toast.success('Other devices were signed out.')
    } catch (mutationError) {
      const message = readableError(mutationError, 'Other devices could not be signed out.')
      if (isWrongPassword(message)) {
        setFieldError('That is not your current password.')
        focusField('account-devices-password')
      } else {
        setError(message)
      }
    }
  }

  return (
    <SettingsPanel
      action={
        <Button disabled={loading} type="submit">
          {loading ? 'Signing out…' : 'Sign out other devices'}
        </Button>
      }
      description="Signed in on a shared or lost device? Sign out every other browser and phone. You stay signed in here."
      error={error}
      formId="account-devices-form"
      note="Use this if you think someone else may be signed in to your account."
      onSubmit={submit}
      title="Devices"
    >
      <fieldset className="grid gap-4 sm:max-w-md" disabled={loading}>
        <TextField error={fieldError} id="account-devices-password" label="Current password">
          <Input
            aria-invalid={fieldError ? true : undefined}
            autoComplete="current-password"
            id="account-devices-password"
            onChange={(event) => {
              setPassword(event.target.value)
              setFieldError(null)
            }}
            type="password"
            value={password}
          />
        </TextField>
      </fieldset>
    </SettingsPanel>
  )
}
