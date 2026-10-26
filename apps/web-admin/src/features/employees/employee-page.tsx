import { useMutation, useQuery } from '@apollo/client'
import { LayoutGrid, List, Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/features/shared/confirm-dialog'
import { FilterSelect, SegmentedControl } from '@/features/shared/controls'
import { EmptyState } from '@/features/shared/data-table'
import { readableError } from '@/lib/graphql-errors'
import { PageIntro } from '@/features/shared/page-intro'
import { useReferenceData } from '@/features/shared/reference-data'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { formatStatus, plural } from '@/lib/format'
import { cn } from '@/lib/utils'

import { EmployeeActionSheet, type EmployeeAction } from './action-sheets'
import { PeopleCards, PeopleTable, SetupChecklist, type RowActions } from './components'
import {
  DEACTIVATE_EMPLOYEE_MUTATION,
  EMPLOYEE_COMPENSATIONS_QUERY,
  PEOPLE_QUERY,
  PEOPLE_REFETCH,
} from './graphql'
import { NewEmployeeSheet } from './new-employee-sheet'
import { grantableRoles, type Compensation, type Person, type ProfileForm } from './types'

type View = 'table' | 'cards'
const VIEW_KEY = 'hrflow.people.view'

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table'
  } catch {
    return 'table'
  }
}

// Tables need room; on phones People always shows cards so actions stay in reach.
const WIDE_QUERY = '(min-width: 768px)'
function subscribeWide(callback: () => void) {
  const media = window.matchMedia(WIDE_QUERY)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function useIsWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true)
}

export function EmployeesPage() {
  const { account } = useAdminSession()
  const canManage = canManageAccounts(account)
  const grantable = grantableRoles(account?.roles ?? [])

  const reference = useReferenceData()
  const peopleQuery = useQuery<{ employees: Person[] }>(PEOPLE_QUERY)
  const compensationQuery = useQuery<{ employeeCompensations: Compensation[] }>(EMPLOYEE_COMPENSATIONS_QUERY, {
    skip: !canManage,
  })
  const [deactivateEmployee] = useMutation(DEACTIVATE_EMPLOYEE_MUTATION, { refetchQueries: PEOPLE_REFETCH })
  const [confirm, confirmDialog] = useConfirm()

  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [signInFilter, setSignInFilter] = useState('')
  const [view, setViewState] = useState<View>(readView)
  const [newOpen, setNewOpen] = useState(false)
  const [action, setAction] = useState<{ type: EmployeeAction; person: Person } | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [prefill, setPrefill] = useState<Partial<ProfileForm> | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const isWide = useIsWide()

  const people = useMemo(() => peopleQuery.data?.employees ?? [], [peopleQuery.data])
  const compensations = compensationQuery.data?.employeeCompensations ?? []
  const currencyCode = reference.companySettings?.currencyCode ?? 'AED'

  const setView = (next: View) => {
    setViewState(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Preference only; ignore storage failures.
    }
  }

  const statusOptions = useMemo(
    () =>
      [...new Set(people.map((person) => person.status))]
        .sort()
        .map((status) => ({ value: status, label: formatStatus(status) })),
    [people],
  )

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    return people
      .filter((person) => !departmentFilter || person.departmentId === departmentFilter)
      .filter((person) => !statusFilter || person.status === statusFilter)
      .filter((person) =>
        !signInFilter ? true : signInFilter === 'with' ? person.hasLinkedAccount : !person.hasLinkedAccount,
      )
      .filter((person) =>
        !term
          ? true
          : [person.fullName, person.employeeNumber, person.email, person.department.name, person.designation.title]
              .join(' ')
              .toLowerCase()
              .includes(term),
      )
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName))
  }, [people, deferredSearch, departmentFilter, statusFilter, signInFilter])

  const loading = (peopleQuery.loading && !peopleQuery.data) || (reference.loading && !reference.data)
  const activeDepartments = reference.departments.filter((d) => d.isActive)
  const activeDesignations = reference.designations.filter((d) => d.isActive)
  const freshInstall = !loading && (activeDepartments.length === 0 || people.length === 0)
  const canAddEmployee = canManage && activeDepartments.length > 0 && activeDesignations.length > 0
  const filtersActive = Boolean(search || departmentFilter || statusFilter || signInFilter)
  const activeFilterCount = [departmentFilter, statusFilter, signInFilter].filter(Boolean).length
  const effectiveView: View = isWide ? view : 'cards'

  // Recruitment hands over a hired candidate as /employees?new=1&firstName=…
  useEffect(() => {
    if (searchParams.get('new') !== '1' || loading) return
    if (canAddEmployee) {
      const fields = ['firstName', 'lastName', 'email', 'phone', 'departmentId', 'designationId'] as const
      const next: Partial<ProfileForm> = {}
      for (const field of fields) {
        const value = searchParams.get(field)
        if (value) next[field] = value
      }
      setPrefill(next)
      setNewOpen(true)
    }
    setSearchParams({}, { replace: true })
  }, [searchParams, loading, canAddEmployee, setSearchParams])

  const handleDeactivate = async (person: Person) => {
    const ok = await confirm({
      title: `Deactivate ${person.fullName}?`,
      description: person.hasLinkedAccount
        ? 'Their sign-in stops working and they leave future payroll runs. Their history stays.'
        : 'They leave future payroll runs and attendance. Their history stays.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateEmployee({ variables: { input: { id: person.id } } })
      toast.success(`${person.fullName} deactivated.`)
    } catch (error) {
      toast.error(readableError(error, 'The employee could not be deactivated.'))
    }
  }

  const rowActions: RowActions = {
    canManage,
    hasPay: (id) => compensations.some((c) => c.employeeId === id),
    onAction: (type, person) => {
      setAction({ type, person })
    },
    onDeactivate: (person) => void handleDeactivate(person),
  }

  return (
    <div className="space-y-5">
      <PageIntro
        actions={
          canManage ? (
            <Button
              disabled={!canAddEmployee}
              onClick={() => {
                setPrefill(null)
                setNewOpen(true)
              }}
              title={canAddEmployee ? undefined : 'Create a department and designation in Organisation first'}
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              New employee
            </Button>
          ) : null
        }
        description={
          people.length > 0
            ? `${plural(people.filter((p) => p.isActive).length, 'active person', 'active people')} across ${plural(activeDepartments.length, 'department')}.`
            : 'Everyone on the team, their role and how they sign in.'
        }
        title="People"
      />

      {peopleQuery.error ? (
        <Notice tone="danger">People could not be loaded. {readableError(peopleQuery.error, '')}</Notice>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading people…</CardContent>
        </Card>
      ) : freshInstall ? (
        <SetupChecklist
          canManage={canManage}
          hasCompany={Boolean(reference.companySettings)}
          hasDepartments={activeDepartments.length > 0}
          hasDesignations={activeDesignations.length > 0}
          hasEmployees={people.length > 0}
          hasSites={reference.sites.some((s) => s.isActive)}
          onNewEmployee={() => setNewOpen(true)}
        />
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap gap-2 md:grid md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_auto]">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search people"
                  className="h-10 pl-10"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, number or email"
                  type="search"
                  value={search}
                />
              </div>
              <Button
                aria-controls="people-filters"
                aria-expanded={filtersOpen}
                className="h-10 shrink-0 md:hidden"
                onClick={() => setFiltersOpen((open) => !open)}
                type="button"
                variant="outline"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
              <div className={cn('basis-full gap-2 md:contents', filtersOpen ? 'grid' : 'hidden')} id="people-filters">
              <FilterSelect
                allLabel="All departments"
                id="people-department"
                label="Department"
                onChange={setDepartmentFilter}
                options={reference.departments.map((d) => ({ value: d.id, label: d.name }))}
                value={departmentFilter}
              />
              <FilterSelect
                allLabel="Any status"
                id="people-status"
                label="Status"
                onChange={setStatusFilter}
                options={statusOptions}
                value={statusFilter}
              />
              <FilterSelect
                allLabel="Any sign-in"
                id="people-signin"
                label="Sign-in"
                onChange={setSignInFilter}
                options={[
                  { value: 'with', label: 'Can sign in' },
                  { value: 'without', label: 'No sign-in' },
                ]}
                value={signInFilter}
              />
              </div>
              <div className="hidden md:block">
              <SegmentedControl
                label="View"
                onChange={setView}
                options={[
                  { value: 'table', label: 'Table', icon: List },
                  { value: 'cards', label: 'Cards', icon: LayoutGrid },
                ]}
                value={view}
              />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              <span aria-live="polite">
                {filtersActive
                  ? `Showing ${filtered.length} of ${plural(people.length, 'person', 'people')}`
                  : plural(people.length, 'person', 'people')}
              </span>
              {filtersActive ? (
                <button
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setSearch('')
                    setDepartmentFilter('')
                    setStatusFilter('')
                    setSignInFilter('')
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              ) : null}
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="Nobody matches these filters">Try a different name or clear the filters.</EmptyState>
            ) : effectiveView === 'table' ? (
              <PeopleTable actions={rowActions} people={filtered} />
            ) : (
              <PeopleCards actions={rowActions} people={filtered} />
            )}
          </CardContent>
        </Card>
      )}

      <NewEmployeeSheet
        currencyCode={currencyCode}
        departments={reference.departments}
        designations={reference.designations}
        grantable={grantable}
        initialProfile={prefill}
        onFinished={(text) => toast.success(text)}
        onOpenChange={setNewOpen}
        open={newOpen}
        people={people}
        sites={reference.sites}
      />

      <EmployeeActionSheet
        action={action?.type ?? null}
        compensation={action ? compensations.find((c) => c.employeeId === action.person.id) ?? null : null}
        currencyCode={currencyCode}
        departments={reference.departments}
        designations={reference.designations}
        canRevoke={account?.roles.includes('ADMIN') ?? false}
        grantable={grantable}
        onClose={() => setAction(null)}
        onSaved={(text) => toast.success(text)}
        people={people}
        person={action?.person ?? null}
        sites={reference.sites}
      />
      {confirmDialog}
    </div>
  )
}
