import { CalendarDays } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#476a56',
  accentStrong: '#2d4537',
  accentSoft: '#e6ede5',
  accentAlt: '#f3ede3',
  bgStart: '#f5f2ea',
  bgEnd: '#f5f2ea',
  surface: 'rgba(255,252,248,0.98)',
  surfaceMuted: 'rgba(244,240,232,0.96)',
  border: 'rgba(188,195,184,0.92)',
  ink: '#243028',
  muted: '#6e736b',
}

export const calendarBoardDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--calendar-board bg-[#f5f2ea]',
  dashboardMetricKey: 'leave',
  home: {
    badge: 'Planning home',
    title: 'Coverage, leave, and timing in one warmer planning studio.',
    description: 'The home page keeps the Welcome House sense of arrival, but the content is tuned toward timing, overlap, and leave coverage rather than onboarding.',
    milestones: ['Confirm overlap risk', 'Check month coverage', 'Review release windows'],
  },
  icon: CalendarDays,
  meta: {
    id: 'leave-atelier',
    title: 'Leave Atelier',
    summary: 'Planning-heavy HR suite where leave, coverage, and timing stay at the center of the product.',
    tagline: 'Calendar-led leave and coverage planning',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance is clearest when timing and planning stay in the same frame.',
    directory: 'Directory tasks benefit from availability and team coverage context.',
    employees: 'Employee work stays tied to start dates, overlaps, and planning context.',
    leave: 'This is the natural home for a leave-led planning system.',
    payroll: 'Payroll timing and payout windows still fit inside the planning atelier.',
    policies: 'Policy rollouts become timed releases with reminder cycles and review windows.',
    recruitment: 'Recruiting can also be shaped by milestones, travel, and interview timing.',
    reports: 'Reporting is easier to interpret when timing and coverage remain visible.',
  },
  palette,
  shell: 'hybrid',
  supportLabel: 'Planning notes',
  supportNotes: ['Leadership offsite overlaps the payroll cutoff.', 'Engineering has three overlapping leave requests.', 'Remote work reminders should go out before Friday.'],
  workLabel: 'Coverage board',
})
