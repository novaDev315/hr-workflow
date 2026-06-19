import { Wallet } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#7ea364',
  accentStrong: '#47602f',
  accentSoft: '#edf3e4',
  accentAlt: '#f4ecdf',
  bgStart: '#f7f4ed',
  bgEnd: '#f7f4ed',
  surface: 'rgba(255,252,247,0.98)',
  surfaceMuted: 'rgba(237,243,228,0.7)',
  border: 'rgba(134,153,117,0.16)',
  ink: '#1f241d',
  muted: '#5f665a',
}

export const payrollLedgerDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--payroll-ledger bg-[#fbfaf6]',
  dashboardMetricKey: 'payroll',
  home: {
    badge: 'Cycle garden',
    title: 'Payroll can open with care, clarity, and softer cycle review.',
    description: 'The home page borrows the warmer welcome pattern so finance-heavy work starts from context, milestones, and human pacing before it drops into controls.',
    milestones: ['Reconcile late changes', 'Confirm payout readiness', 'Review variance notes'],
  },
  icon: Wallet,
  meta: {
    id: 'payroll-garden',
    title: 'Payroll Garden',
    summary: 'Compensation workspace with guided cycle review, calmer summaries, and more human payroll pacing.',
    tagline: 'Softer payroll and compensation desk',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance signals matter here because overtime and shift drift affect the cycle story.',
    directory: 'Directory routes support payroll ownership and compensation context, not just lookup.',
    employees: 'Employee records are read through compensation setup, owner handoff, and cycle readiness.',
    leave: 'Leave timing stays visible because absence and carry-over rules shape payroll confidence.',
    payroll: 'This is the natural home for guided cycle review, variance watch, and payout preparation.',
    policies: 'Policy reading focuses on pay practice clarity, allowances, and compliance notes.',
    recruitment: 'Hiring is shown through salary bands, approvals, and compensation planning.',
    reports: 'Reporting emphasizes deltas, forecast pressure, and payout confidence.',
  },
  palette,
  shell: 'desk',
  supportLabel: 'Finance notes',
  supportNotes: ['Two employees still need bank details.', 'Overtime pressure is above forecast in Operations.', 'The bank export window closes tomorrow at noon.'],
  workLabel: 'Compensation desk',
})
