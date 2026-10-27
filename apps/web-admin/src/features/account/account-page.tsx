import { gql, useMutation, useQuery } from '@apollo/client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'

import { ChangePasswordSheet } from '@/components/layouts/change-password-sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { TextField } from '@/features/shared/controls'
import { PageIntro, SectionHeading } from '@/features/shared/page-intro'
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

// Focus after render so the field's error is announced with it.
const focusField = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

export function AccountPage() {
  const { account } = useAdminSession()
  const me = useQuery(ME_QUERY, { fetchPolicy: 'network-only' })
  const profile = me.data?.me
  const linked = Boolean(profile?.employeeId)

  if (!account) return null

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageIntro
        description="Your own profile, sign-in email, password and signed-in devices."
        title="Account settings"
      />

      {me.error ? (
        <Notice tone="danger">{readableError(me.error, 'Your account details could not be loaded.')}</Notice>
      ) : null}

      <AccountSection
        description={
          linked
            ? 'Your name comes from your employee record. HR can change it in People.'
            : 'How your name appears in the workspace.'
        }
        id="profile"
        title="Profile"
      >
        <ProfileForm
          firstName={profile?.firstName ?? account.firstName}
          lastName={profile?.lastName ?? account.lastName}
          locked={linked || me.loading}
        />
        <dl className="grid gap-3 border-t border-border/70 pt-4 text-sm sm:grid-cols-2">
          <Detail label="Roles">
            {account.roles.length ? account.roles.map(formatStatus).join(', ') : '—'}
          </Detail>
          {linked ? (
            <>
              <Detail label="Employee number">{profile?.employeeNumber ?? '—'}</Detail>
              <Detail label="Department">{profile?.departmentName ?? '—'}</Detail>
              <Detail label="Designation">{profile?.designationTitle ?? '—'}</Detail>
            </>
          ) : null}
        </dl>
      </AccountSection>

      <AccountSection
        description="The email you sign in with. Changing it signs out your other devices."
        id="email"
        title="Sign-in email"
      >
        <EmailForm currentEmail={account.email} />
      </AccountSection>

      <AccountSection
        description="Use at least 8 characters. Changing it signs out your other devices."
        id="password"
        title="Password"
      >
        <PasswordRow />
      </AccountSection>

      <AccountSection
        description="Signed in on a shared or lost device? Enter your password to sign out everywhere except here."
        id="sessions"
        title="Signed-in devices"
      >
        <SignOutOthersRow />
      </AccountSection>
    </div>
  )
}

function AccountSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`account-${id}-heading`} className="scroll-mt-24" id={id}>
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <SectionHeading description={description} id={`account-${id}-heading`} title={title} />
          {children}
        </CardContent>
      </Card>
    </section>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  )
}

function ProfileForm({ firstName, lastName, locked }: { firstName: string; lastName: string; locked: boolean }) {
  const [form, setForm] = useState({ firstName, lastName })
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [save, { loading }] = useMutation(UPDATE_PROFILE_MUTATION)

  useEffect(() => {
    setForm({ firstName, lastName })
  }, [firstName, lastName])

  const unchanged = form.firstName.trim() === firstName && form.lastName.trim() === lastName

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
    } catch (mutationError) {
      setError(readableError(mutationError, 'Your name could not be saved.'))
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={submit}>
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={locked || loading}>
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
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {locked ? null : (
        <div className="flex justify-end">
          <Button disabled={loading || unchanged} type="submit">
            {loading ? 'Saving…' : 'Save name'}
          </Button>
        </div>
      )}
    </form>
  )
}

function EmailForm({ currentEmail }: { currentEmail: string }) {
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
    <form className="space-y-4" noValidate onSubmit={submit}>
      <p className="text-sm text-muted-foreground">
        Currently <span className="font-medium text-foreground">{currentEmail}</span>
      </p>
      <fieldset className="grid gap-4 sm:grid-cols-2" disabled={loading}>
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
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="flex justify-end">
        <Button disabled={loading} type="submit">
          {loading ? 'Changing…' : 'Change email'}
        </Button>
      </div>
    </form>
  )
}

function PasswordRow() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex justify-end">
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        Change password
      </Button>
      <ChangePasswordSheet onOpenChange={setOpen} open={open} />
    </div>
  )
}

function SignOutOthersRow() {
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [signOutOthers, { loading }] = useMutation(SIGN_OUT_OTHERS_MUTATION)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!password) {
      setFieldError('Enter your current password.')
      return focusField('account-sessions-password')
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
      if (/current password is incorrect/i.test(message)) {
        setFieldError('That is not your current password.')
        focusField('account-sessions-password')
      } else {
        toast.error(message)
      }
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" noValidate onSubmit={submit}>
      <TextField error={fieldError} id="account-sessions-password" label="Current password">
        <Input
          aria-invalid={fieldError ? true : undefined}
          autoComplete="current-password"
          disabled={loading}
          id="account-sessions-password"
          onChange={(event) => {
            setPassword(event.target.value)
            setFieldError(null)
          }}
          type="password"
          value={password}
        />
      </TextField>
      <div className="flex justify-end">
        <Button disabled={loading} type="submit" variant="outline">
          {loading ? 'Signing out…' : 'Sign out other devices'}
        </Button>
      </div>
    </form>
  )
}
