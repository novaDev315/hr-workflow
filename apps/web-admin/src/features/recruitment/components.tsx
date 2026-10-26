import { ExternalLink, Pause, Pencil, Play, CheckCheck, XCircle, Undo2, FileText, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { DataTable, EmptyState, Td, Th, Tr } from '@/features/shared/data-table'
import { OverflowMenu, type OverflowMenuItem } from '@/features/shared/overflow-menu'
import { formatDay, formatMoney, formatNumber, formatStatus, plural, safeExternalUrl } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  PIPELINE_STAGES,
  isTerminalApplication,
  nextApplicationAction,
  priorityTone,
  stageFor,
  statusTone,
} from './presentation'
import type { JobRequisition, RecruitmentApplication } from './types'

/* ----------------------------------------------------------------------------
 * Pipeline board
 * ------------------------------------------------------------------------- */

export type ApplicationHandlers = {
  busy: boolean
  onAdvance: (application: RecruitmentApplication, status: string, done: string) => void
  onClose: (application: RecruitmentApplication, status: 'REJECTED' | 'WITHDRAWN') => void
  onEdit: (application: RecruitmentApplication) => void
  /** Link that opens People's new-employee sheet prefilled for a hire. */
  employeeLinkFor: (application: RecruitmentApplication) => string
}

export function PipelineBoard({
  applications,
  currencyFor,
  handlers,
}: {
  applications: RecruitmentApplication[]
  currencyFor: (application: RecruitmentApplication) => string
  handlers: ApplicationHandlers
}) {
  return (
    <div className="relative overflow-x-auto pb-2">
      <div className="grid min-w-[1000px] grid-cols-5 gap-3">
        {PIPELINE_STAGES.map((stage) => {
          const items = applications.filter((application) => stageFor(application.status) === stage.key)
          return (
            <section aria-label={stage.label} className="flex min-w-0 flex-col rounded-xl bg-secondary/45 p-2" key={stage.key}>
              <header className="flex items-center justify-between px-1.5 pb-2 pt-1">
                <h3 className="text-[13px] font-semibold text-foreground">{stage.label}</h3>
                <span className="rounded-full bg-card px-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/80 px-2 py-4 text-center text-xs text-muted-foreground">
                    No candidates
                  </p>
                ) : (
                  items.map((application) => (
                    <CandidateCard
                      application={application}
                      currency={currencyFor(application)}
                      handlers={handlers}
                      key={application.id}
                      showStatus={stage.statuses.length > 1}
                    />
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function CandidateCard({
  application,
  currency,
  handlers,
  showStatus,
}: {
  application: RecruitmentApplication
  currency: string
  handlers: ApplicationHandlers
  showStatus: boolean
}) {
  const next = nextApplicationAction(application.status)
  const terminal = isTerminalApplication(application.status)
  const resume = safeExternalUrl(application.resumeUrl)
  const facts = [
    application.yearsExperience !== null && application.yearsExperience !== undefined
      ? plural(application.yearsExperience, 'year', 'years')
      : null,
    application.source || null,
  ].filter(Boolean)

  const menu: OverflowMenuItem[] = [
    { label: 'Edit details', icon: Pencil, onSelect: () => handlers.onEdit(application) },
    {
      label: 'Open résumé',
      icon: ExternalLink,
      hidden: !resume,
      onSelect: () => {
        if (resume) window.open(resume, '_blank', 'noopener,noreferrer')
      },
    },
    { label: 'Reject', icon: XCircle, tone: 'danger', hidden: terminal, onSelect: () => handlers.onClose(application, 'REJECTED') },
    { label: 'Mark withdrawn', icon: Undo2, tone: 'danger', hidden: terminal, onSelect: () => handlers.onClose(application, 'WITHDRAWN') },
  ]

  return (
    <article className="rounded-lg border border-border/70 bg-card p-3 shadow-[0_1px_2px_rgba(60,42,30,0.04)]">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={application.candidateName}>
            <bdi>{application.candidateName}</bdi>
          </p>
          <p className="truncate text-xs text-muted-foreground" title={application.jobTitle}>{application.jobTitle}</p>
        </div>
        <OverflowMenu className="-mr-1 -mt-1" items={menu} label={`More actions for ${application.candidateName}`} />
      </div>

      {showStatus || application.status === 'HIRED' || terminal ? (
        <StatusBadge className="mt-2 normal-case tracking-normal" tone={statusTone(application.status)}>
          {formatStatus(application.status)}
        </StatusBadge>
      ) : null}

      <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
        {facts.length ? (
          <div className="truncate">
            <dt className="sr-only">Experience and source</dt>
            <dd>{facts.join(' · ')}</dd>
          </div>
        ) : null}
        {application.expectedSalary ? (
          <div className="truncate">
            <dt className="sr-only">Expected salary</dt>
            <dd>Expects {formatMoney(application.expectedSalary, currency)}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground/80" title={application.applicationNumber}>
        {application.applicationNumber}
      </p>

      {next ? (
        <Button
          className="mt-2.5 h-8 w-full text-[13px]"
          disabled={handlers.busy}
          onClick={() => handlers.onAdvance(application, next.status, next.done)}
          size="sm"
          type="button"
          variant={next.status === 'HIRED' ? 'default' : 'outline'}
        >
          {next.label}
        </Button>
      ) : null}

      {application.status === 'HIRED' ? (
        <Button asChild className="mt-2.5 h-8 w-full text-[13px]" size="sm" variant="outline">
          <Link to={handlers.employeeLinkFor(application)}>
            <UserPlus aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Create employee record
          </Link>
        </Button>
      ) : null}
    </article>
  )
}

/* ----------------------------------------------------------------------------
 * Requisitions
 * ------------------------------------------------------------------------- */

export type RequisitionHandlers = {
  busy: boolean
  onEdit: (requisition: JobRequisition) => void
  onStatus: (requisition: JobRequisition, status: string, label: string) => void
  onShowCandidates: (requisition: JobRequisition) => void
}

function salaryRange(requisition: JobRequisition) {
  const { salaryMin, salaryMax, currencyCode } = requisition
  if (salaryMin && salaryMax) return `${formatMoney(salaryMin, currencyCode)} – ${formatMoney(salaryMax, currencyCode)}`
  if (salaryMin) return `From ${formatMoney(salaryMin, currencyCode)}`
  if (salaryMax) return `Up to ${formatMoney(salaryMax, currencyCode)}`
  return null
}

export function RequisitionsTable({
  requisitions,
  handlers,
}: {
  requisitions: JobRequisition[]
  handlers: RequisitionHandlers
}) {
  if (requisitions.length === 0) {
    return <EmptyState title="No openings match">Create a requisition to start collecting candidates.</EmptyState>
  }
  return (
    <DataTable label="Job requisitions" minWidth={900}>
      <thead>
        <tr>
          <Th className="w-[32%]">Role</Th>
          <Th>Status</Th>
          <Th>Priority</Th>
          <Th className="text-right">Positions</Th>
          <Th className="text-right">Candidates</Th>
          <Th>Target start</Th>
          <Th className="w-12"><span className="sr-only">Actions</span></Th>
        </tr>
      </thead>
      <tbody>
        {requisitions.map((requisition) => {
          const open = ['OPEN', 'ON_HOLD'].includes(requisition.status)
          const range = salaryRange(requisition)
          const items: OverflowMenuItem[] = [
            { label: 'View candidates', icon: FileText, onSelect: () => handlers.onShowCandidates(requisition) },
            { label: 'Edit', icon: Pencil, onSelect: () => handlers.onEdit(requisition) },
            {
              label: 'Put on hold',
              icon: Pause,
              hidden: requisition.status !== 'OPEN',
              disabled: handlers.busy,
              onSelect: () => handlers.onStatus(requisition, 'ON_HOLD', 'Put on hold'),
            },
            {
              label: 'Reopen',
              icon: Play,
              hidden: requisition.status !== 'ON_HOLD',
              disabled: handlers.busy,
              onSelect: () => handlers.onStatus(requisition, 'OPEN', 'Reopen'),
            },
            {
              label: 'Mark filled',
              icon: CheckCheck,
              hidden: !open,
              disabled: handlers.busy,
              onSelect: () => handlers.onStatus(requisition, 'FILLED', 'Mark filled'),
            },
            {
              label: 'Close',
              icon: XCircle,
              tone: 'danger',
              hidden: !open,
              disabled: handlers.busy,
              onSelect: () => handlers.onStatus(requisition, 'CLOSED', 'Close'),
            },
          ]
          return (
            <Tr className={open ? undefined : 'text-muted-foreground'} key={requisition.id}>
              <Td>
                <p className="font-medium text-foreground">{requisition.jobTitle}</p>
                <p className="truncate text-xs text-muted-foreground" title={requisition.requisitionNumber}>
                  {requisition.departmentName} · {formatStatus(requisition.employmentType)}
                  {range ? ` · ${range}` : ''}
                </p>
              </Td>
              <Td>
                <StatusBadge className="whitespace-nowrap" tone={statusTone(requisition.status)}>
                  {formatStatus(requisition.status)}
                </StatusBadge>
              </Td>
              <Td>
                <StatusBadge className="whitespace-nowrap" tone={priorityTone(requisition.priority)}>
                  {formatStatus(requisition.priority)}
                </StatusBadge>
              </Td>
              <Td className="text-right tabular-nums">{formatNumber(requisition.positionsCount)}</Td>
              <Td className="text-right tabular-nums">
                <button
                  className={cn('rounded px-1 underline-offset-4 hover:text-primary hover:underline')}
                  onClick={() => handlers.onShowCandidates(requisition)}
                  title="Show these candidates on the board"
                  type="button"
                >
                  {formatNumber(requisition.applicationCount)}
                </button>
              </Td>
              <Td className="whitespace-nowrap tabular-nums">{formatDay(requisition.targetStartDate)}</Td>
              <Td className="py-2 text-right">
                <OverflowMenu items={items} label={`Actions for ${requisition.jobTitle}`} />
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}
