export type RecruitmentTone =
  | 'accent'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'success'
  | 'warning'

export function formatStatus(status: string) {
  return status
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export function statusTone(status: string): RecruitmentTone {
  if (['OPEN', 'HIRED', 'SELECTED', 'OFFER_EXTENDED'].includes(status)) {
    return 'success'
  }
  if (
    ['SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(
      status,
    )
  ) {
    return 'info'
  }
  if (['ON_HOLD', 'RECEIVED'].includes(status)) {
    return 'warning'
  }
  if (['REJECTED', 'WITHDRAWN', 'CLOSED'].includes(status)) {
    return 'danger'
  }
  return 'neutral'
}

export function priorityTone(priority: string): RecruitmentTone {
  if (['HIGH', 'URGENT'].includes(priority)) return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'neutral'
}

export function nextApplicationAction(status: string) {
  const actions: Record<string, { status: string; label: string }> = {
    RECEIVED: { status: 'SCREENING', label: 'Start Screening' },
    SCREENING: { status: 'SHORTLISTED', label: 'Shortlist' },
    SHORTLISTED: { status: 'INTERVIEW_SCHEDULED', label: 'Schedule Interview' },
    INTERVIEW_SCHEDULED: { status: 'INTERVIEWED', label: 'Mark Interviewed' },
    INTERVIEWED: { status: 'SELECTED', label: 'Select' },
    SELECTED: { status: 'OFFER_EXTENDED', label: 'Extend Offer' },
    OFFER_EXTENDED: { status: 'HIRED', label: 'Mark Hired' },
  }

  return actions[status] ?? null
}

export function isTerminalApplication(status: string) {
  return ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(status)
}

export function actionPastTense(label: string) {
  const labels: Record<string, string> = {
    Close: 'closed',
    Hold: 'held',
    Reopen: 'reopened',
    'Mark filled': 'marked filled',
    Reject: 'rejected',
    Withdraw: 'withdrawn',
  }

  return labels[label] ?? label.toLowerCase()
}
