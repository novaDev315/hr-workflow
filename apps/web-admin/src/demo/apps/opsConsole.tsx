import { Command } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#8f6d53',
  accentStrong: '#5e4434',
  accentSoft: '#eee2d7',
  accentAlt: '#e9ece0',
  bgStart: '#f4efe8',
  bgEnd: '#f2f0e9',
  surface: 'rgba(255,252,248,0.97)',
  surfaceMuted: 'rgba(244,238,230,0.96)',
  border: 'rgba(206,194,182,0.92)',
  ink: '#2a211c',
  muted: '#776a61',
}

export const opsConsoleDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--ops-console bg-[#f4efe8]',
  dashboardMetricKey: 'attendance',
  home: {
    badge: 'Field home',
    title: 'Operations can start warm, then drop quickly into the notebook.',
    description: 'The home page uses the same welcoming dashboard pattern, then shifts into the faster care-and-exception modules that support field operations and site visibility.',
    milestones: ['Resolve exception queue', 'Review geofence mismatches', 'Confirm operator handoffs'],
  },
  icon: Command,
  meta: {
    id: 'field-notes',
    title: 'Field Notes',
    summary: 'Attendance and site operations workspace with notebook energy, quick logs, and exception-first review.',
    tagline: 'Operations notebook for people teams',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'This is the natural home for active rosters, shift exceptions, and site review.',
    directory: 'Directory views support operators who need location and team context quickly.',
    employees: 'Employees are framed through registry work, access gaps, and operational readiness.',
    leave: 'Leave work stays close to response windows, overlap pressure, and site coverage.',
    payroll: 'Payroll routes focus on held records, export readiness, and operator follow-up.',
    policies: 'Policies are handled like field guidance and operational playbooks.',
    recruitment: 'Recruitment is shown as a staffing queue with operational urgency.',
    reports: 'Reporting emphasizes coverage pressure, queue health, and unresolved alerts.',
  },
  palette,
  shell: 'desk',
  supportLabel: 'Operator notes',
  supportNotes: ['Four geofence mismatches need review.', 'Two payroll records are still on hold.', 'Nine leave requests hit today’s response window.'],
  workLabel: 'Field notebook',
})
