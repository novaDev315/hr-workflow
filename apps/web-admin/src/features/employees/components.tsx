import {
  Building2,
  CheckCircle2,
  Circle,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  UserX,
  Wallet,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, Td, Th, Tr } from '@/features/shared/data-table'
import { OverflowMenu, type OverflowMenuItem } from '@/features/shared/overflow-menu'
import { formatDay, formatStatus } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { EmployeeAction } from './action-sheets'
import { employeeStatusTone, initials, signInLabel, type Person } from './types'

export type RowActions = {
  canManage: boolean
  hasPay: (personId: string) => boolean
  onAction: (action: EmployeeAction, person: Person) => void
  onDeactivate: (person: Person) => void
}

function rowMenuItems(person: Person, actions: RowActions): OverflowMenuItem[] {
  return [
    { label: 'Edit employee', icon: Pencil, onSelect: () => actions.onAction('edit', person) },
    {
      label: actions.hasPay(person.id) ? 'Update pay' : 'Set up pay',
      icon: Wallet,
      onSelect: () => actions.onAction('pay', person),
      hidden: !person.isActive,
    },
    { label: 'Assign site', icon: MapPin, onSelect: () => actions.onAction('site', person), hidden: !person.isActive },
    {
      label: person.hasLinkedAccount ? 'Staff access' : 'Give sign-in access',
      icon: KeyRound,
      onSelect: () => actions.onAction('signin', person),
      hidden: !person.isActive,
    },
    {
      label: 'Deactivate',
      icon: UserX,
      tone: 'danger',
      onSelect: () => actions.onDeactivate(person),
      hidden: !person.isActive,
    },
  ]
}

function SignInCell({ person }: { person: Person }) {
  const roles = signInLabel(person)
  if (!roles) return <span className="text-muted-foreground">No sign-in</span>
  return <span>{roles.map((role) => formatStatus(role)).join(', ')}</span>
}

export function PeopleTable({ people, actions }: { people: Person[]; actions: RowActions }) {
  return (
    <DataTable label="People" minWidth={860}>
      <thead>
        <tr>
          <Th className="w-[30%]">Name</Th>
          <Th>Department</Th>
          <Th>Designation</Th>
          <Th>Sign-in</Th>
          <Th>Joined</Th>
          <Th>Status</Th>
          {actions.canManage ? <Th className="w-12"><span className="sr-only">Actions</span></Th> : null}
        </tr>
      </thead>
      <tbody>
        {people.map((person) => (
          <Tr className={person.isActive ? undefined : 'text-muted-foreground'} key={person.id}>
            <Td className="py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={person.fullName} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground" title={person.fullName}>{person.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground" title={person.email}>
                    {person.employeeNumber}
                  </p>
                </div>
              </div>
            </Td>
            <Td className="whitespace-nowrap">{person.department.name}</Td>
            <Td className="max-w-[200px]"><span className="line-clamp-2">{person.designation.title}</span></Td>
            <Td className="whitespace-nowrap text-[13px]"><SignInCell person={person} /></Td>
            <Td className="whitespace-nowrap tabular-nums">{formatDay(person.joinDate)}</Td>
            <Td>
              <StatusBadge className="whitespace-nowrap" tone={employeeStatusTone(person.status)}>
                {formatStatus(person.status)}
              </StatusBadge>
            </Td>
            {actions.canManage ? (
              <Td className="py-2 text-right">
                <OverflowMenu items={rowMenuItems(person, actions)} label={`Actions for ${person.fullName}`} />
              </Td>
            ) : null}
          </Tr>
        ))}
      </tbody>
    </DataTable>
  )
}

export function PeopleCards({ people, actions }: { people: Person[]; actions: RowActions }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => (
        <Card className={cn('min-w-0 shadow-none', !person.isActive && 'opacity-70')} key={person.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar large name={person.fullName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{person.fullName}</p>
                    <p className="truncate text-sm text-muted-foreground">{person.designation.title}</p>
                  </div>
                  {actions.canManage ? (
                    <OverflowMenu items={rowMenuItems(person, actions)} label={`Actions for ${person.fullName}`} />
                  ) : null}
                </div>
                <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <CardLine icon={<Building2 className="h-3.5 w-3.5" />} label="Department">
                    {person.department.name}
                    {person.isActive ? null : ` · ${formatStatus(person.status)}`}
                  </CardLine>
                  <CardLine icon={<Mail className="h-3.5 w-3.5" />} label="Email">
                    <a className="block truncate text-primary underline-offset-4 hover:underline" href={`mailto:${person.email}`}>
                      {person.email}
                    </a>
                  </CardLine>
                  <CardLine icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                    {person.phone ? (
                      <a className="hover:text-foreground" href={`tel:${person.phone.replace(/\s+/g, '')}`}>{person.phone}</a>
                    ) : (
                      'No phone recorded'
                    )}
                  </CardLine>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  {person.employeeNumber}
                  {person.supervisorName ? ` · Reports to ${person.supervisorName}` : ''}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function CardLine({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="shrink-0">
        {icon}
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  )
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary',
        large ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-[11px]',
      )}
    >
      {initials(name)}
    </div>
  )
}

export function SetupChecklist({
  hasCompany,
  hasDepartments,
  hasDesignations,
  hasSites,
  hasEmployees,
  canManage,
  onNewEmployee,
}: {
  hasCompany: boolean
  hasDepartments: boolean
  hasDesignations: boolean
  hasSites: boolean
  hasEmployees: boolean
  canManage: boolean
  onNewEmployee: () => void
}) {
  const ready = hasDepartments && hasDesignations
  const items: { done: boolean; title: string; detail: string; action: ReactNode }[] = [
    {
      done: hasCompany,
      title: 'Add company details',
      detail: 'Name, currency and time zone used on payslips and reports.',
      action: <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/organisation#company">Open Organisation</Link>,
    },
    {
      done: hasDepartments && hasDesignations,
      title: 'Create a department and a designation',
      detail: 'Every employee belongs to one department and holds one designation.',
      action: <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/organisation#departments">Set up structure</Link>,
    },
    {
      done: hasSites,
      title: 'Add a work site',
      detail: 'Needed before anyone can clock in. You can skip this if you do not track attendance.',
      action: <Link className="text-sm font-semibold text-primary underline-offset-4 hover:underline" to="/organisation#sites">Add a site</Link>,
    },
    {
      done: hasEmployees,
      title: 'Add your first employee',
      detail: 'A short guided form covers profile, pay, work site and sign-in.',
      action: canManage ? (
        <Button disabled={!ready} onClick={onNewEmployee} size="sm" title={ready ? undefined : 'Create a department and designation first'} type="button">
          New employee
        </Button>
      ) : null,
    },
  ]
  const remaining = items.filter((item) => !item.done).length

  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <h2 className="app-editorial text-[1.35rem] leading-tight text-foreground">Set up your team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {remaining === 0 ? 'Everything is ready.' : `${remaining} of ${items.length} steps left before People fills up.`}
        </p>
        <ol className="mt-5 divide-y divide-border/70 rounded-xl border border-border/70">
          {items.map((item) => (
            <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between" key={item.title}>
              <div className="flex items-start gap-3">
                {item.done ? (
                  <CheckCircle2 aria-label="Done" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                ) : (
                  <Circle aria-label="To do" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/60" />
                )}
                <div>
                  <p className={cn('text-sm font-semibold', item.done ? 'text-muted-foreground line-through decoration-border' : 'text-foreground')}>
                    {item.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              </div>
              {item.done ? null : <div className="shrink-0 pl-8 sm:pl-0">{item.action}</div>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
