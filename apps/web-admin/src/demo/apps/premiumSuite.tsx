import { Diamond } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#c97d4f',
  accentStrong: '#724730',
  accentSoft: '#f2e1d5',
  accentAlt: '#efe7da',
  bgStart: '#f6f2eb',
  bgEnd: '#f6f2eb',
  surface: 'rgba(255,252,248,0.98)',
  surfaceMuted: 'rgba(248,243,237,0.96)',
  border: 'rgba(114,71,48,0.12)',
  ink: '#231a17',
  muted: '#6e6058',
}

export const premiumSuiteDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--premium-suite bg-[#f6f2eb]',
  dashboardMetricKey: 'employee',
  home: {
    badge: 'Welcome system',
    title: 'A warmer home for onboarding and first-week work.',
    description: 'The dashboard acts like a welcome desk, with milestones, softer progress cues, and a calmer first-run experience for people operations.',
    milestones: ['Prepare day-one access', 'Check policy rollouts', 'Confirm manager welcome plan'],
  },
  icon: Diamond,
  meta: {
    id: 'welcome-house',
    title: 'Welcome House',
    summary: 'Onboarding-first HR home with milestone framing, concierge-style setup, and a more generous first-run feel.',
    tagline: 'Onboarding-first HR home',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance and operational work are translated into arrival, readiness, and support moments.',
    directory: 'Directory search stays warm and welcoming instead of feeling like a cold directory dump.',
    employees: 'Employee administration is framed as a concierge workflow for setup and first-week clarity.',
    leave: 'Leave review is framed around cover plans, manager context, and newcomer timing.',
    payroll: 'Payroll becomes part of a well-paced onboarding and compensation story.',
    policies: 'Policies are positioned as guided reading for the first month, not a pile of documents.',
    recruitment: 'Recruitment keeps the same generous layout while spotlighting handoffs and interview readiness.',
    reports: 'Reporting reads more like a people progress deck than a generic dashboard.',
  },
  palette,
  shell: 'rail',
  supportLabel: 'Concierge notes',
  supportNotes: ['Starter kits still need device confirmation.', 'Two manager intros are waiting on calendar slots.', 'Policy reading reminders go out at 4 PM.'],
  workLabel: 'Welcome desk',
})
