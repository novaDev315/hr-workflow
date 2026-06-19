import { Newspaper } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#0075de',
  accentStrong: '#005bab',
  accentSoft: '#f2f9ff',
  accentAlt: '#f6f5f4',
  bgStart: '#ffffff',
  bgEnd: '#ffffff',
  surface: 'rgba(255,255,255,0.98)',
  surfaceMuted: 'rgba(246,245,244,0.94)',
  border: 'rgba(0,0,0,0.1)',
  ink: 'rgba(0,0,0,0.95)',
  muted: '#615d59',
}

export const executiveBriefDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--executive-brief bg-white',
  dashboardMetricKey: 'report',
  home: {
    badge: 'Brief home',
    title: 'Leadership pages can open with warmth before they become a working brief.',
    description: 'The dashboard keeps the softer welcome pattern while the rest of the product narrows into a more decision-ready reporting and commentary workspace.',
    milestones: ['Read the daily summary', 'Check open decisions', 'Review workforce movement'],
  },
  icon: Newspaper,
  meta: {
    id: 'brief-deck',
    title: 'Brief Deck',
    summary: 'Leadership review product with narrative sections, briefing strips, and decision-ready HR summaries.',
    tagline: 'Narrative leadership review',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance pressure, location exceptions, and operator notes are framed as a readable brief.',
    directory: 'Directory search is presented as a people memo rather than a control panel.',
    employees: 'Employee operations are laid out like a workforce register with commentary nearby.',
    leave: 'Leave routes stay connected to decisions, timing, and executive review.',
    payroll: 'Payroll gets presented through review notes, deltas, and decision-ready summaries.',
    policies: 'Policies read as recommendation surfaces with narrative context.',
    recruitment: 'Recruitment is shown through movement, hiring pace, and leadership implications.',
    reports: 'This is the natural home for the strongest reporting cadence and decision framing.',
  },
  palette,
  shell: 'hybrid',
  supportLabel: 'Decision strip',
  supportNotes: ['Nine leave requests still need review.', 'Operations overtime is above plan.', 'Policy acknowledgements are nearly complete.'],
  workLabel: 'Briefing deck',
})
