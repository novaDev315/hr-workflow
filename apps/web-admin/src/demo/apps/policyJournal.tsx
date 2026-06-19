import { BookOpen } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#171717',
  accentStrong: '#171717',
  accentSoft: 'rgba(245,242,239,0.8)',
  accentAlt: '#f5f5f5',
  bgStart: '#ffffff',
  bgEnd: '#f5f5f5',
  surface: 'rgba(255,255,255,0.98)',
  surfaceMuted: 'rgba(245,242,239,0.9)',
  border: 'rgba(0,0,0,0.06)',
  ink: '#171717',
  muted: '#777169',
}

export const policyJournalDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--policy-journal bg-[#f5f5f5]',
  dashboardMetricKey: 'policy',
  home: {
    badge: 'Library home',
    title: 'Governance opens better with a warm front door and a readable spine.',
    description: 'The dashboard takes the Welcome House style home page and adapts it into a calm reading-first entry to policy work, rollout notes, and acknowledgement status.',
    milestones: ['Check unread acknowledgements', 'Review legal comments', 'Publish final drafts'],
  },
  icon: BookOpen,
  meta: {
    id: 'policy-library',
    title: 'Policy Library',
    summary: 'Reading-first governance system with library structure, acknowledgement flows, and calm document pacing.',
    tagline: 'Reading-first governance workspace',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance work benefits from explanation and policy context instead of anonymous admin chrome.',
    directory: 'Directory context can still be calm, readable, and text-forward.',
    employees: 'Employee work is shown through the same editorial and document-aware lens.',
    leave: 'Leave review keeps policy notes and margin context nearby.',
    payroll: 'Payroll guidance and exception handling can be surfaced editorially.',
    policies: 'This is the strongest home for a document-first governance system.',
    recruitment: 'Hiring guidance uses more reading rhythm and fewer commodity panels.',
    reports: 'Reporting becomes clearer when the writing and pacing are intentional.',
  },
  palette,
  shell: 'rail',
  supportLabel: 'Margin notes',
  supportNotes: ['Remote work policy still needs 18 acknowledgements.', 'Probation framework is waiting on legal review.', 'Travel guidance draft should publish this week.'],
  workLabel: 'Reading aids',
})
