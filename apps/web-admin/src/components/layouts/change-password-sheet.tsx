import { gql, useMutation } from '@apollo/client'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Notice } from '@/components/ui/notice'
import { SideSheet } from '@/features/shared/side-sheet'
import { persistAdminSession, useAdminSession } from '@/lib/auth-session'
import { readableError } from '@/lib/graphql-errors'
import { toast } from '@/lib/toast'

const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      accessToken
      account {
        id
        email
        firstName
        lastName
        fullName
        roles
        canAccessAdminPanel
        canManageAccounts
        isActive
      }
    }
  }
`

type Form = { current: string; next: string; confirm: string }
type Errors = Partial<Record<keyof Form, string>>

const EMPTY: Form = { current: '', next: '', confirm: '' }

function validate(form: Form): Errors {
  const errors: Errors = {}
  if (!form.current) errors.current = 'Enter your current password.'
  if (form.next.length < 8) errors.next = 'Use at least 8 characters.'
  else if (new TextEncoder().encode(form.next).length > 72) errors.next = 'Use a shorter password (72 bytes at most).'
  else if (form.next === form.current) errors.next = 'Choose a password different from the current one.'
  if (!errors.next && form.confirm !== form.next) errors.confirm = 'The passwords do not match.'
  return errors
}

export function ChangePasswordSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<Form>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD_MUTATION)
  const { account } = useAdminSession()
  // Don't let the sheet close mid-save, or a failure would go unseen.
  const close = (next: boolean) => {
    if (!next && loading) return
    onOpenChange(next)
  }
  // Focus after render so the field's error is announced with it.
  const focusField = (key: keyof Form) =>
    requestAnimationFrame(() => document.getElementById(`change-password-${key}`)?.focus())

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setErrors({})
    setError(null)
  }, [open])

  const update = (key: keyof Form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async () => {
    setError(null)
    const fieldErrors = validate(form)
    setErrors(fieldErrors)
    const first = (['current', 'next', 'confirm'] as const).find((key) => fieldErrors[key])
    if (first) {
      focusField(first)
      return
    }
    try {
      const result = await changePassword({ variables: { input: { currentPassword: form.current, newPassword: form.next } } })
      const payload = result.data?.changePassword
      if (!payload?.accessToken) throw new Error('The password could not be changed. Please try again.')
      persistAdminSession(payload)
      toast.success('Password changed. Other devices were signed out.')
      onOpenChange(false)
    } catch (mutationError) {
      const message = readableError(mutationError, 'The password could not be changed.')
      if (/current password is incorrect/i.test(message)) {
        setErrors({ current: 'That is not your current password.' })
        focusField('current')
      } else {
        setError(message)
      }
    }
  }

  const field = (key: keyof Form, label: string, autoComplete: string, hint?: string) => (
    <div className="space-y-2">
      <Label htmlFor={`change-password-${key}`}>{label}</Label>
      <Input
        aria-describedby={errors[key] || hint ? `change-password-${key}-note` : undefined}
        aria-invalid={errors[key] ? true : undefined}
        autoComplete={autoComplete}
        id={`change-password-${key}`}
        onChange={(event) => update(key, event.target.value)}
        type="password"
        value={form[key]}
      />
      {errors[key] ? (
        <p className="text-sm text-destructive" id={`change-password-${key}-note`}>
          {errors[key]}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground" id={`change-password-${key}-note`}>
          {hint}
        </p>
      ) : null}
    </div>
  )

  return (
    <SideSheet
      description="You stay signed in here. Other devices are signed out."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button disabled={loading} onClick={() => close(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={loading} form="change-password-form" type="submit">
            {loading ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      }
      onOpenChange={close}
      open={open}
      title="Change password"
    >
      <form
        className="space-y-5"
        id="change-password-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {error ? (
          <Notice role="alert" tone="danger">
            {error}
          </Notice>
        ) : null}
        {/* Lets password managers update the saved sign-in for this account. */}
        <input autoComplete="username" className="sr-only" readOnly tabIndex={-1} type="email" value={account?.email ?? ''} aria-hidden="true" />
        {field('current', 'Current password', 'current-password')}
        {field('next', 'New password', 'new-password', 'At least 8 characters.')}
        {field('confirm', 'Confirm new password', 'new-password')}
      </form>
    </SideSheet>
  )
}
