import { AdminTableEmpty } from '@/components/admin/admin-table'
import { RecordCard } from '@/components/admin/record-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Pencil, XCircle } from 'lucide-react'

import {
  formatStatus,
  isTerminalApplication,
  nextApplicationAction,
  priorityTone,
  statusTone,
} from './presentation'
import type { JobRequisition, RecruitmentApplication } from './types'

export function JobRequisitionListCard({
  changingRequisitionStatus,
  handleEditRequisition,
  handleRequisitionStatus,
  loading,
  requisitions,
}: {
  changingRequisitionStatus: boolean
  handleEditRequisition: (requisition: JobRequisition) => void
  handleRequisitionStatus: (
    requisitionId: string,
    status: string,
    label: string,
  ) => void
  loading: boolean
  requisitions: JobRequisition[]
}) {
  return (
    <Card>
      <CardHeader>
        <p className="app-kicker">Openings</p>
        <CardTitle>Job requisitions</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading requisitions...</p>
        ) : requisitions.length === 0 ? (
          <AdminTableEmpty>No requisitions match the current filters.</AdminTableEmpty>
        ) : (
          <div className="space-y-3">
            {requisitions.map((requisition) => (
              <RecordCard key={requisition.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{requisition.jobTitle}</p>
                      <StatusBadge tone={statusTone(requisition.status)}>
                        {formatStatus(requisition.status)}
                      </StatusBadge>
                      <StatusBadge tone={priorityTone(requisition.priority)}>
                        {formatStatus(requisition.priority)}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {requisition.requisitionNumber} - {requisition.departmentName}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {requisition.description}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {requisition.positionsCount} position
                      {requisition.positionsCount === 1 ? '' : 's'} -{' '}
                      {formatStatus(requisition.employmentType)} -{' '}
                      {requisition.applicationCount} candidate
                      {requisition.applicationCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() => handleEditRequisition(requisition)}
                    >
                      <Pencil className="mr-2 h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {requisition.status === 'ON_HOLD' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={changingRequisitionStatus}
                        onClick={() =>
                          handleRequisitionStatus(requisition.id, 'OPEN', 'Reopen')
                        }
                      >
                        Reopen
                      </Button>
                    ) : requisition.status === 'OPEN' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={changingRequisitionStatus}
                        onClick={() =>
                          handleRequisitionStatus(requisition.id, 'ON_HOLD', 'Hold')
                        }
                      >
                        Hold
                      </Button>
                    ) : null}
                    {['OPEN', 'ON_HOLD'].includes(requisition.status) ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={changingRequisitionStatus}
                          onClick={() =>
                            handleRequisitionStatus(
                              requisition.id,
                              'FILLED',
                              'Mark filled',
                            )
                          }
                        >
                          Mark Filled
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          disabled={changingRequisitionStatus}
                          onClick={() =>
                            handleRequisitionStatus(requisition.id, 'CLOSED', 'Close')
                          }
                        >
                          Close
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </RecordCard>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RecruitmentApplicationListCard({
  advancingApplication,
  applications,
  handleApplicationStatus,
  handleEditApplication,
  loading,
}: {
  advancingApplication: boolean
  applications: RecruitmentApplication[]
  handleApplicationStatus: (
    applicationId: string,
    status: string,
    label: string,
  ) => void
  handleEditApplication: (application: RecruitmentApplication) => void
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <p className="app-kicker">Candidates</p>
        <CardTitle>Application workflow</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : applications.length === 0 ? (
          <AdminTableEmpty>No applications match the current filters.</AdminTableEmpty>
        ) : (
          <div className="space-y-3">
            {applications.map((application) => {
              const nextAction = nextApplicationAction(application.status)
              return (
                <RecordCard key={application.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-foreground">
                          {application.candidateName}
                        </p>
                        <StatusBadge tone={statusTone(application.status)}>
                          {formatStatus(application.status)}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {application.applicationNumber} - {application.jobTitle}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {application.email}
                        {application.phone ? ` - ${application.phone}` : ''}
                        {application.source ? ` - ${application.source}` : ''}
                      </p>
                      {application.notes ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {application.notes}
                        </p>
                      ) : null}
                      {application.decisionNotes ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Decision: {application.decisionNotes}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => handleEditApplication(application)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {nextAction ? (
                        <Button
                          size="sm"
                          type="button"
                          disabled={advancingApplication}
                          onClick={() =>
                            handleApplicationStatus(
                              application.id,
                              nextAction.status,
                              nextAction.label,
                            )
                          }
                        >
                          {nextAction.label}
                        </Button>
                      ) : null}
                      {!isTerminalApplication(application.status) ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            disabled={advancingApplication}
                            onClick={() =>
                              handleApplicationStatus(application.id, 'REJECTED', 'Reject')
                            }
                          >
                            <XCircle className="mr-2 h-3.5 w-3.5" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            disabled={advancingApplication}
                            onClick={() =>
                              handleApplicationStatus(
                                application.id,
                                'WITHDRAWN',
                                'Withdraw',
                              )
                            }
                          >
                            Withdraw
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </RecordCard>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
