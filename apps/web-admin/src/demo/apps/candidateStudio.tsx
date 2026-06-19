import { Briefcase } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#c67854',
  accentStrong: '#7f4a32',
  accentSoft: '#f3e2d7',
  accentAlt: '#ece8de',
  bgStart: '#f6efe8',
  bgEnd: '#f4efe7',
  surface: 'rgba(255,251,247,0.98)',
  surfaceMuted: 'rgba(244,238,231,0.95)',
  border: 'rgba(205,184,169,0.92)',
  ink: '#2f1f18',
  muted: '#75645b',
}

export const candidateStudioDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--candidate-studio bg-[#faf9f6]',
  dashboardMetricKey: 'recruitment',
  home: {
    badge: 'Hiring home',
    title: 'A warmer hiring room for queues, handoffs, and candidate momentum.',
    description: 'The home page uses the same welcome-style warmth, but the content is built for candidate flow, interview momentum, and recruiter handoff clarity.',
    milestones: ['Review panel queue', 'Confirm salary alignment', 'Send candidate updates'],
  },
  icon: Briefcase,
  meta: {
    id: 'candidate-parlor',
    title: 'Candidate Parlor',
    summary: 'Recruiting suite with split-pane focus, candidate spotlights, and handoff notes that feel like a working room.',
    tagline: 'Warm recruiting room for hiring teams',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance routes shift toward handoff quality, exceptions, and coordinator visibility.',
    directory: 'Directory search becomes profile-first instead of table-first.',
    employees: 'Employees can still be handled with the same queue-detail mindset.',
    leave: 'Leave approvals move through a tighter handoff interface with clearer ownership.',
    payroll: 'Payroll issues benefit from a spotlight, queue, and notes structure.',
    policies: 'Policies become review flows with commentary rather than static lists.',
    recruitment: 'This is the clearest home for the split dossier and hiring room workflow.',
    reports: 'Reports become interpretation surfaces instead of isolated metric cards.',
  },
  palette,
  shell: 'hybrid',
  supportLabel: 'Recruiter notes',
  supportNotes: ['Final challenge feedback is due before 5 PM.', 'Offer approval is waiting on compensation signoff.', 'Candidate updates are bundled for tonight.'],
  workLabel: 'Hiring room',
})
