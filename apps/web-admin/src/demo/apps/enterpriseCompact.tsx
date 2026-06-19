import { HeartHandshake } from 'lucide-react'

import { createMixedFamilyDemo } from '@/demo/apps/family'
import type { DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#7b9779',
  accentStrong: '#35513b',
  accentSoft: '#e4ede3',
  accentAlt: '#f1e8dc',
  bgStart: '#f6f4ee',
  bgEnd: '#eef3ee',
  surface: 'rgba(253,251,247,0.98)',
  surfaceMuted: 'rgba(239,244,236,0.96)',
  border: 'rgba(197,206,193,0.9)',
  ink: '#243028',
  muted: '#6f786f',
}

export const enterpriseCompactDemo = createMixedFamilyDemo({
  appClassName: 'demo-app demo-app--enterprise-compact bg-[#f6f4ee]',
  dashboardMetricKey: 'overview',
  home: {
    badge: 'Care home',
    title: 'Programs, support, and follow-up can start with a friendlier home page.',
    description: 'The dashboard mixes the warmer Welcome House entry with Care Loop’s case-and-program way of working, so the first screen feels supportive rather than mechanical.',
    milestones: ['Review active care cases', 'Check manager follow-ups', 'Confirm benefits reminders'],
  },
  icon: HeartHandshake,
  meta: {
    id: 'care-loop',
    title: 'Care Loop',
    summary: 'Compact employee-experience hub for wellbeing, benefits, programs, and follow-up work.',
    tagline: 'Programs and care operations desk',
    spectrum: 'grounded',
  },
  pageCopy: {
    attendance: 'Attendance routes focus on coaching, return-to-work, and follow-up support.',
    directory: 'Directory pages become a way to find care owners, program leads, and employee history.',
    employees: 'Employee records are framed through support loops, programs, and follow-through.',
    leave: 'Leave is handled as part of care planning, wellbeing, and coverage conversations.',
    payroll: 'Payroll issues appear as employee support cases that still need fast resolution.',
    policies: 'Policies become care campaigns, reminders, and acknowledgement follow-up work.',
    recruitment: 'Recruitment is read through candidate care, handoff quality, and program readiness.',
    reports: 'Reporting centers on program health, follow-up load, and support outcomes.',
  },
  palette,
  shell: 'desk',
  supportLabel: 'Support strip',
  supportNotes: ['Two wellbeing check-ins need manager notes.', 'Benefits campaign summary is ready to export.', 'Return-to-work plans look healthy this week.'],
  workLabel: 'Program hub',
})
