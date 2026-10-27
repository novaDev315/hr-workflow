import { useMutation } from '@apollo/client'
import { Pencil, Plus, XCircle } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Notice } from '@/components/ui/notice'
import { StatusBadge } from '@/components/ui/status-badge'
import { Textarea } from '@/components/ui/textarea'
import { useConfirm } from '@/features/shared/confirm-dialog'
import { FilterSelect, SelectField, TextField } from '@/features/shared/controls'
import { DataTable, EmptyState, Td, Th, Tr } from '@/features/shared/data-table'
import { readableError } from '@/lib/graphql-errors'
import { OverflowMenu } from '@/features/shared/overflow-menu'
import type { Department, Designation } from '@/features/shared/reference-data'
import { FormDialog } from '@/features/shared/form-dialog'
import { formatStatus, plural } from '@/lib/format'

import {
  CREATE_DEPARTMENT_MUTATION,
  CREATE_DESIGNATION_MUTATION,
  DEACTIVATE_DEPARTMENT_MUTATION,
  DEACTIVATE_DESIGNATION_MUTATION,
  ORGANISATION_REFETCH,
  UPDATE_DEPARTMENT_MUTATION,
  UPDATE_DESIGNATION_MUTATION,
} from './graphql'

type PeopleCount = (id: string) => number

const CODE_HINT = 'Capital letters, numbers and underscores, for example OPS.'

function normaliseCode(value: string) {
  return value.toUpperCase().replace(/\s+/g, '_')
}

function SheetFooter({
  busy,
  submitLabel,
  onCancel,
  formId,
}: {
  busy: boolean
  submitLabel: string
  onCancel: () => void
  formId: string
}) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button onClick={onCancel} type="button" variant="outline">
        Cancel
      </Button>
      <Button disabled={busy} form={formId} type="submit">
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}

function InactiveBadge({ active }: { active: boolean }) {
  return active ? null : <StatusBadge tone="neutral">{formatStatus('INACTIVE')}</StatusBadge>
}

/* ----------------------------------------------------------------------------
 * Departments
 * ------------------------------------------------------------------------- */

type DepartmentForm = { id: string | null; name: string; code: string; description: string }
const emptyDepartment: DepartmentForm = { id: null, name: '', code: '', description: '' }

export function DepartmentsSection({
  departments,
  peopleIn,
  canEdit,
  onNotice,
}: {
  departments: Department[]
  peopleIn: PeopleCount
  canEdit: boolean
  onNotice: (message: ReactNode, tone: 'success' | 'danger') => void
}) {
  const [form, setForm] = useState<DepartmentForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()
  const [createDepartment, createState] = useMutation(CREATE_DEPARTMENT_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [updateDepartment, updateState] = useMutation(UPDATE_DEPARTMENT_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [deactivateDepartment] = useMutation(DEACTIVATE_DEPARTMENT_MUTATION, { refetchQueries: ORGANISATION_REFETCH })

  const sorted = [...departments].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name),
  )

  const open = (department?: Department) => {
    setError(null)
    setForm(
      department
        ? { id: department.id, name: department.name, code: department.code, description: department.description ?? '' }
        : emptyDepartment,
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    setError(null)
    const input = { name: form.name.trim(), code: form.code.trim(), description: form.description.trim() || null }
    try {
      if (form.id) {
        await updateDepartment({ variables: { input: { id: form.id, ...input } } })
        onNotice(`${input.name} updated.`, 'success')
      } else {
        await createDepartment({ variables: { input } })
        onNotice(`${input.name} added.`, 'success')
      }
      setForm(null)
    } catch (mutationError) {
      setError(readableError(mutationError, 'The department could not be saved.'))
    }
  }

  const handleDeactivate = async (department: Department) => {
    const count = peopleIn(department.id)
    const ok = await confirm({
      title: `Deactivate ${department.name}?`,
      description:
        count > 0
          ? `${plural(count, 'active person', 'active people')} still belong to it. Move them first, or the change will be refused.`
          : 'It will no longer be offered for new employees or openings. Existing records keep it.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateDepartment({ variables: { input: { id: department.id } } })
      onNotice(`${department.name} deactivated.`, 'success')
    } catch (mutationError) {
      onNotice(readableError(mutationError, 'The department could not be deactivated.'), 'danger')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {plural(departments.filter((d) => d.isActive).length, 'active department')}
        </p>
        {canEdit ? (
          <Button onClick={() => open()} size="sm" type="button" variant="outline">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add department
          </Button>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <EmptyState title="No departments yet">
          Departments group people for reporting, approvals and payroll. Add the first one to
          start building the team.
        </EmptyState>
      ) : (
        <DataTable label="Departments" minWidth={560}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th className="text-right">People</Th>
              <Th className="w-12"><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((department) => (
              <Tr className={department.isActive ? undefined : 'text-muted-foreground'} key={department.id}>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{department.name}</span>
                    <InactiveBadge active={department.isActive} />
                  </div>
                  {department.description ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{department.description}</p>
                  ) : null}
                </Td>
                <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{department.code}</Td>
                <Td className="text-right tabular-nums">{peopleIn(department.id)}</Td>
                <Td className="py-2 text-right">
                  {canEdit ? (
                    <OverflowMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => open(department) },
                        {
                          label: 'Deactivate',
                          icon: XCircle,
                          tone: 'danger',
                          hidden: !department.isActive,
                          onSelect: () => void handleDeactivate(department),
                        },
                      ]}
                      label={`Actions for ${department.name}`}
                    />
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <FormDialog
        footer={
          <SheetFooter
            busy={createState.loading || updateState.loading}
            formId="department-form"
            onCancel={() => setForm(null)}
            submitLabel={form?.id ? 'Save department' : 'Add department'}
          />
        }
        onOpenChange={(next) => !next && setForm(null)}
        open={form !== null}
        title={form?.id ? 'Edit department' : 'New department'}
      >
        {form ? (
          <form className="space-y-4" id="department-form" onSubmit={handleSubmit}>
            <TextField id="department-name" label="Name">
              <Input
                id="department-name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Operations"
                required
                value={form.name}
              />
            </TextField>
            <TextField hint={CODE_HINT} id="department-code" label="Code">
              <Input
                autoComplete="off"
                id="department-code"
                onChange={(event) => setForm({ ...form, code: normaliseCode(event.target.value) })}
                placeholder="OPS"
                required
                value={form.code}
              />
            </TextField>
            <TextField id="department-description" label="Description" optional>
              <Textarea
                className="min-h-[5.5rem]"
                id="department-description"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                value={form.description}
              />
            </TextField>
            {error ? <Notice tone="danger">{error}</Notice> : null}
          </form>
        ) : null}
      </FormDialog>
      {confirmDialog}
    </div>
  )
}

/* ----------------------------------------------------------------------------
 * Designations
 * ------------------------------------------------------------------------- */

type DesignationForm = {
  id: string | null
  title: string
  code: string
  departmentId: string
  level: string
  description: string
}

export function DesignationsSection({
  departments,
  designations,
  peopleIn,
  canEdit,
  onNotice,
}: {
  departments: Department[]
  designations: Designation[]
  peopleIn: PeopleCount
  canEdit: boolean
  onNotice: (message: ReactNode, tone: 'success' | 'danger') => void
}) {
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [form, setForm] = useState<DesignationForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, confirmDialog] = useConfirm()
  const [createDesignation, createState] = useMutation(CREATE_DESIGNATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [updateDesignation, updateState] = useMutation(UPDATE_DESIGNATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH, awaitRefetchQueries: true })
  const [deactivateDesignation] = useMutation(DEACTIVATE_DESIGNATION_MUTATION, { refetchQueries: ORGANISATION_REFETCH })

  const departmentName = (id: string) => departments.find((d) => d.id === id)?.name ?? '—'
  const activeDepartments = departments.filter((d) => d.isActive)
  const rows = designations
    .filter((designation) => !departmentFilter || designation.departmentId === departmentFilter)
    .sort(
      (a, b) =>
        Number(b.isActive) - Number(a.isActive) ||
        departmentName(a.departmentId).localeCompare(departmentName(b.departmentId)) ||
        b.level - a.level ||
        a.title.localeCompare(b.title),
    )

  const open = (designation?: Designation) => {
    setError(null)
    setForm(
      designation
        ? {
            id: designation.id,
            title: designation.title,
            code: designation.code,
            departmentId: designation.departmentId,
            level: String(designation.level),
            description: designation.description ?? '',
          }
        : {
            id: null,
            title: '',
            code: '',
            departmentId: departmentFilter || (activeDepartments.length === 1 ? activeDepartments[0].id : ''),
            level: '1',
            description: '',
          },
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form) return
    if (!form.departmentId) {
      setError('Choose the department this designation belongs to.')
      return
    }
    setError(null)
    const input = {
      title: form.title.trim(),
      code: form.code.trim(),
      departmentId: form.departmentId,
      level: Number.parseInt(form.level || '1', 10),
      description: form.description.trim() || null,
    }
    try {
      if (form.id) {
        await updateDesignation({ variables: { input: { id: form.id, ...input } } })
        onNotice(`${input.title} updated.`, 'success')
      } else {
        await createDesignation({ variables: { input } })
        onNotice(`${input.title} added.`, 'success')
      }
      setForm(null)
    } catch (mutationError) {
      setError(readableError(mutationError, 'The designation could not be saved.'))
    }
  }

  const handleDeactivate = async (designation: Designation) => {
    const count = peopleIn(designation.id)
    const ok = await confirm({
      title: `Deactivate ${designation.title}?`,
      description:
        count > 0
          ? `${plural(count, 'active person', 'active people')} still hold it. Change their designation first, or the change will be refused.`
          : 'It will no longer be offered for new employees or openings.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deactivateDesignation({ variables: { input: { id: designation.id } } })
      onNotice(`${designation.title} deactivated.`, 'success')
    } catch (mutationError) {
      onNotice(readableError(mutationError, 'The designation could not be deactivated.'), 'danger')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <FilterSelect
          allLabel="All departments"
          className="sm:w-60"
          id="designation-department-filter"
          label="Filter designations by department"
          onChange={setDepartmentFilter}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
          value={departmentFilter}
        />
        {canEdit ? (
          <Button
            disabled={activeDepartments.length === 0}
            onClick={() => open()}
            size="sm"
            title={activeDepartments.length === 0 ? 'Add a department first' : undefined}
            type="button"
            variant="outline"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add designation
          </Button>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title={designations.length === 0 ? 'No designations yet' : 'No designations in this department'}>
          {activeDepartments.length === 0
            ? 'Add a department first, then the job titles people hold inside it.'
            : 'Designations are the job titles people hold, such as Shift supervisor or Accountant.'}
        </EmptyState>
      ) : (
        <DataTable label="Designations" minWidth={620}>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Department</Th>
              <Th className="text-right">Level</Th>
              <Th>Code</Th>
              <Th className="text-right">People</Th>
              <Th className="w-12"><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((designation) => (
              <Tr className={designation.isActive ? undefined : 'text-muted-foreground'} key={designation.id}>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{designation.title}</span>
                    <InactiveBadge active={designation.isActive} />
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{departmentName(designation.departmentId)}</Td>
                <Td className="text-right tabular-nums">{designation.level}</Td>
                <Td className="whitespace-nowrap font-mono text-xs text-muted-foreground">{designation.code}</Td>
                <Td className="text-right tabular-nums">{peopleIn(designation.id)}</Td>
                <Td className="py-2 text-right">
                  {canEdit ? (
                    <OverflowMenu
                      items={[
                        { label: 'Edit', icon: Pencil, onSelect: () => open(designation) },
                        {
                          label: 'Deactivate',
                          icon: XCircle,
                          tone: 'danger',
                          hidden: !designation.isActive,
                          onSelect: () => void handleDeactivate(designation),
                        },
                      ]}
                      label={`Actions for ${designation.title}`}
                    />
                  ) : null}
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      )}

      <FormDialog
        footer={
          <SheetFooter
            busy={createState.loading || updateState.loading}
            formId="designation-form"
            onCancel={() => setForm(null)}
            submitLabel={form?.id ? 'Save designation' : 'Add designation'}
          />
        }
        onOpenChange={(next) => !next && setForm(null)}
        open={form !== null}
        title={form?.id ? 'Edit designation' : 'New designation'}
      >
        {form ? (
          <form className="space-y-4" id="designation-form" onSubmit={handleSubmit}>
            <TextField id="designation-title" label="Title">
              <Input
                id="designation-title"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Shift supervisor"
                required
                value={form.title}
              />
            </TextField>
            <SelectField
              id="designation-department"
              label="Department"
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              options={activeDepartments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Choose a department"
              required
              value={form.departmentId}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField hint={CODE_HINT.replace('OPS', 'OPS_SUP')} id="designation-code" label="Code">
                <Input
                  autoComplete="off"
                  id="designation-code"
                  onChange={(event) => setForm({ ...form, code: normaliseCode(event.target.value) })}
                  placeholder="OPS_SUP"
                  required
                  value={form.code}
                />
              </TextField>
              <TextField hint="1 is entry level; higher numbers are more senior." id="designation-level" label="Level">
                <Input
                  id="designation-level"
                  inputMode="numeric"
                  min={1}
                  onChange={(event) => setForm({ ...form, level: event.target.value })}
                  type="number"
                  value={form.level}
                />
              </TextField>
            </div>
            <TextField id="designation-description" label="Description" optional>
              <Textarea
                className="min-h-[5.5rem]"
                id="designation-description"
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                value={form.description}
              />
            </TextField>
            {error ? <Notice tone="danger">{error}</Notice> : null}
          </form>
        ) : null}
      </FormDialog>
      {confirmDialog}
    </div>
  )
}
