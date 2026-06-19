import { Compass } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#6a8aa6',
  accentStrong: '#35556d',
  accentSoft: '#e7eff5',
  accentAlt: '#eef1e5',
  bgStart: '#f3f6f8',
  bgEnd: '#f3f5f1',
  surface: 'rgba(252,251,247,0.98)',
  surfaceMuted: 'rgba(237,242,245,0.94)',
  border: 'rgba(170,185,196,0.2)',
  ink: '#23323b',
  muted: '#5f6d74',
}

export const peopleAtlasDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--people-atlas bg-[#f3f6f8]',
  dashboardMetricKey: 'overview',
  home: {
    badge: 'Atlas home',
    title: 'A people map that starts with teams, shape, and coverage.',
    description: 'The home page mixes a warmer welcome surface with a discovery-first structure so org search feels like navigation through the company, not through records.',
    milestones: ['Open the org map', 'Review staffing pockets', 'Check manager coverage'],
  },
  icon: Compass,
  meta: {
    id: 'atlas-board',
    title: 'Atlas Board',
    summary: 'Directory-led HR suite built around org browsing, staff discovery, and team-aware actions.',
    tagline: 'Organization map and directory first',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance still benefits from org-aware context and team framing.',
    directory: 'Directory search should feel like exploring the organization, not paging through records.',
    employees: 'Employee operations are framed through team shape and staffing context.',
    leave: 'Leave review stays connected to team availability and department coverage.',
    payroll: 'Payroll review includes enough organizational context for HR partners and team leads.',
    policies: 'Policy distribution ties back to teams, readers, and coverage responsibilities.',
    recruitment: 'Recruitment is positioned as a staffing problem inside the broader org map.',
    reports: 'Reporting still starts from who the people are and how teams are shaped.',
  },
  palette,
  shell: 'rail',
  supportLabel: 'Discovery notes',
  supportNotes: ['Two team clusters need manager assignments.', 'Search filters should stay pinned for recruiters.', 'Remote support visibility is rising this week.'],
  workLabel: 'Discovery dock',
})
