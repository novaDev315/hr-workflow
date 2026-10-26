export type RecruitmentTone =
  | 'accent'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'success'
  | 'warning'

export type StageKey = 'received' | 'screening' | 'interview' | 'offer' | 'closed'

export const PIPELINE_STAGES: { key: StageKey; label: string; statuses: string[] }[] = [
  { key: 'received', label: 'Received', statuses: ['RECEIVED'] },
  { key: 'screening', label: 'Screening', statuses: ['SCREENING', 'SHORTLISTED'] },
  { key: 'interview', label: 'Interview', statuses: ['INTERVIEW_SCHEDULED', 'INTERVIEWED'] },
  { key: 'offer', label: 'Offer', statuses: ['SELECTED', 'OFFER_EXTENDED'] },
  { key: 'closed', label: 'Closed', statuses: ['HIRED', 'REJECTED', 'WITHDRAWN'] },
]

export function stageFor(status: string): StageKey {
  return PIPELINE_STAGES.find((stage) => stage.statuses.includes(status))?.key ?? 'received'
}

export function statusTone(status: string): RecruitmentTone {
  if (['OPEN', 'HIRED', 'SELECTED', 'OFFER_EXTENDED'].includes(status)) return 'success'
  if (['SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED'].includes(status)) return 'info'
  if (['ON_HOLD', 'RECEIVED'].includes(status)) return 'warning'
  if (['REJECTED', 'WITHDRAWN', 'CLOSED'].includes(status)) return 'danger'
  return 'neutral'
}

export function priorityTone(priority: string): RecruitmentTone {
  if (['HIGH', 'URGENT'].includes(priority)) return 'danger'
  if (priority === 'MEDIUM') return 'warning'
  return 'neutral'
}

// One step forward along the hiring path the API enforces.
export function nextApplicationAction(status: string) {
  const actions: Record<string, { status: string; label: string; done: string }> = {
    RECEIVED: { status: 'SCREENING', label: 'Start screening', done: 'moved to screening' },
    SCREENING: { status: 'SHORTLISTED', label: 'Shortlist', done: 'shortlisted' },
    SHORTLISTED: { status: 'INTERVIEW_SCHEDULED', label: 'Schedule interview', done: 'scheduled for interview' },
    INTERVIEW_SCHEDULED: { status: 'INTERVIEWED', label: 'Mark interviewed', done: 'marked interviewed' },
    INTERVIEWED: { status: 'SELECTED', label: 'Select', done: 'selected' },
    SELECTED: { status: 'OFFER_EXTENDED', label: 'Extend offer', done: 'sent an offer' },
    OFFER_EXTENDED: { status: 'HIRED', label: 'Mark hired', done: 'marked hired' },
  }
  return actions[status] ?? null
}

export function isTerminalApplication(status: string) {
  return ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(status)
}

export function requisitionDone(label: string) {
  const labels: Record<string, string> = {
    Close: 'closed',
    'Put on hold': 'put on hold',
    Reopen: 'reopened',
    'Mark filled': 'marked filled',
  }
  return labels[label] ?? label.toLowerCase()
}
