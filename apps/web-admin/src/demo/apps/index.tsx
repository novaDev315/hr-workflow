import type { DemoAppModule } from '@/demo/catalog'

import { candidateStudioDemo } from '@/demo/apps/candidateStudio'
import { calendarBoardDemo } from '@/demo/apps/calendarBoard'
import { enterpriseCompactDemo } from '@/demo/apps/enterpriseCompact'
import { executiveBriefDemo } from '@/demo/apps/executiveBrief'
import { opsConsoleDemo } from '@/demo/apps/opsConsole'
import { payrollLedgerDemo } from '@/demo/apps/payrollLedger'
import { peopleAtlasDemo } from '@/demo/apps/peopleAtlas'
import { policyJournalDemo } from '@/demo/apps/policyJournal'
import { premiumSuiteDemo } from '@/demo/apps/premiumSuite'
import { talentHavenDemo } from '@/demo/apps/talentHaven'

export const demoApps: DemoAppModule[] = [
  talentHavenDemo,
  premiumSuiteDemo,
  peopleAtlasDemo,
  payrollLedgerDemo,
  calendarBoardDemo,
  candidateStudioDemo,
  policyJournalDemo,
  opsConsoleDemo,
  executiveBriefDemo,
  enterpriseCompactDemo,
]

export function findDemoApp(demoId?: string) {
  return demoApps.find((demo) => demo.meta.id === demoId) ?? null
}
