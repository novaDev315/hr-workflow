import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { readableError } from '@/lib/graphql-errors'
import {
  useSiteAssignments,
  type Department,
  type Designation,
  type WorkSite,
} from '@/features/shared/reference-data'
import { SideSheet } from '@/features/shared/side-sheet'
import { formatStatus } from '@/lib/format'

import { PayFields, ProfileFields, SignInFields, SiteFields } from './step-forms'
import {
  generatePassword,
  useEmployeeMutations,
  validatePay,
  focusFirstProfileError,
  profileFieldErrors,
  validateProfile,
  type ProfileErrors,
  validateSignIn,
} from './mutations'
import {
  emptyPay,
  payFromCompensation,
  profileFromPerson,
  type Compensation,
  type PayForm,
  type Person,
  type ProfileForm,
  type SignInForm,
  type SiteForm,
} from './types'

export type EmployeeAction = 'edit' | 'pay' | 'site' | 'signin'

const TITLES: Record<EmployeeAction, string> = {
  edit: 'Edit employee',
  pay: 'Set up pay',
  site: 'Assign work site',
  signin: 'Give sign-in access',
}

export function EmployeeActionSheet({
  action,
  person,
  onClose,
  onSaved,
  departments,
  designations,
  people,
  sites,
  compensation,
  currencyCode,
  grantable,
}: {
  action: EmployeeAction | null
  person: Person | null
  onClose: () => void
  onSaved: (message: string) => void
  departments: Department[]
  designations: Designation[]
  people: Person[]
  sites: WorkSite[]
  compensation: Compensation | null
  currencyCode: string
  grantable: string[]
}) {
  const mutations = useEmployeeMutations()
  const open = Boolean(action && person)
  const [profile, setProfile] = useState<ProfileForm | null>(null)
  const [pay, setPay] = useState<PayForm>(() => emptyPay(currencyCode))
  const [site, setSite] = useState<SiteForm>({ locationId: '', isPrimary: true })
  const [signIn, setSignIn] = useState<SignInForm>({ createSignIn: true, password: '', staffRole: '' })
  const [error, setError] = useState<string | null>(null)
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [busy, setBusy] = useState(false)
  const [password, setPassword] = useState<string | null>(null)

  const assignments = useSiteAssignments(action === 'site' && person ? [person.id] : [])
  const current = person ? assignments.byEmployee.get(person.id) : undefined

  useEffect(() => {
    if (!open || !person) return
    setError(null)
    setProfileErrors({})
    setPassword(null)
    setProfile(profileFromPerson(person))
    setPay(compensation ? payFromCompensation(compensation) : emptyPay(currencyCode, person.joinDate))
    setSite({ locationId: '', isPrimary: true })
    setSignIn({ createSignIn: !person.hasLinkedAccount, password: person.hasLinkedAccount ? '' : generatePassword(), staffRole: '' })
    // Reset when a new person/action opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, person?.id, action])

  const submit = async () => {
    if (!person || !action) return
    setError(null)
    if (action === 'edit' && profile) {
      const fieldErrors = profileFieldErrors(profile)
      setProfileErrors(fieldErrors)
      if (Object.keys(fieldErrors).length > 0) {
        focusFirstProfileError(fieldErrors)
        return
      }
    }
    const validation =
      action === 'edit'
        ? profile && validateProfile(profile)
        : action === 'pay'
          ? validatePay(pay)
          : action === 'site'
            ? site.locationId
              ? null
              : 'Choose a work site.'
            : !signIn.createSignIn && !signIn.staffRole
              ? person.hasLinkedAccount
                ? 'Choose a staff role to grant.'
                : 'Choose to create a sign-in or a staff role.'
              : validateSignIn(signIn, person.hasLinkedAccount)
    if (validation) {
      setError(validation)
      return
    }
    setBusy(true)
    try {
      if (action === 'edit' && profile) {
        await mutations.saveProfile(profile, person.id)
        onSaved(`${profile.firstName} ${profile.lastName} updated.`)
        onClose()
      } else if (action === 'pay') {
        await mutations.savePay(person.id, pay)
        onSaved(`Pay saved for ${person.fullName}.`)
        onClose()
      } else if (action === 'site') {
        await mutations.saveSite(person.id, site)
        await assignments.refetch()
        const siteName = sites.find((s) => s.id === site.locationId)?.name ?? 'the site'
        onSaved(`${person.fullName} assigned to ${siteName}.`)
        onClose()
      } else if (action === 'signin') {
        await mutations.saveSignIn(person.id, signIn, person.hasLinkedAccount)
        const role = signIn.staffRole ? ` with the ${formatStatus(signIn.staffRole).toLowerCase()} role` : ''
        onSaved(`${person.fullName} can now sign in${role}.`)
        if (!person.hasLinkedAccount) {
          setPassword(signIn.password)
        } else {
          onClose()
        }
      }
    } catch (mutationError) {
      setError(readableError(mutationError, 'The change could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  const title =
    action === 'pay' && compensation
      ? 'Update pay'
      : action === 'signin' && person?.hasLinkedAccount
        ? 'Staff access'
        : action
          ? TITLES[action]
          : ''

  return (
    <SideSheet
      description={person ? `${person.fullName} · ${person.employeeNumber}` : undefined}
      footer={
        password ? (
          <div className="flex justify-end">
            <Button onClick={onClose} type="button">
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={onClose} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={busy} form="employee-action-form" type="submit">
              {busy ? 'Saving…' : action === 'edit' ? 'Save changes' : action === 'site' ? 'Assign site' : action === 'signin' ? (person?.hasLinkedAccount ? 'Grant role' : 'Give access') : 'Save pay'}
            </Button>
          </div>
        )
      }
      onOpenChange={(next) => !next && onClose()}
      open={open}
      title={title}
    >
      {person && action ? (
        password ? (
          <div className="space-y-3 text-sm">
            <Notice tone="success">Sign-in created. Share these details privately.</Notice>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-xl bg-secondary/60 p-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{person.email}</dd>
              <dt className="text-muted-foreground">Temporary password</dt>
              <dd className="font-mono">{password}</dd>
            </dl>
          </div>
        ) : (
          <form
            className="space-y-5"
            id="employee-action-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {error ? <Notice role="alert" tone="danger">{error}</Notice> : null}
            {action === 'edit' && profile ? (
              <ProfileFields
                departments={departments}
                designations={designations}
                editingId={person.id}
                form={profile}
                errors={profileErrors}
                onChange={(patch) => {
                  setProfile((value) => (value ? { ...value, ...patch } : value))
                  setProfileErrors((current) => {
                    const next = { ...current }
                    for (const key of Object.keys(patch) as (keyof ProfileForm)[]) delete next[key]
                    return next
                  })
                }}
                people={people}
                showStatus
              />
            ) : null}
            {action === 'pay' ? <PayFields form={pay} onChange={(patch) => setPay((value) => ({ ...value, ...patch }))} /> : null}
            {action === 'site' ? (
              <SiteFields
                current={current}
                form={site}
                onChange={(patch) => setSite((value) => ({ ...value, ...patch }))}
                sites={sites}
              />
            ) : null}
            {action === 'signin' ? (
              <SignInFields
                form={signIn}
                grantable={grantable}
                onChange={(patch) => setSignIn((value) => ({ ...value, ...patch }))}
                person={person}
              />
            ) : null}
          </form>
        )
      ) : null}
    </SideSheet>
  )
}
