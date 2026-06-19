import type { LucideIcon } from 'lucide-react'
import { BookOpen, MessageSquare, Search, Sparkles } from 'lucide-react'

import { demoHref, getDemoPage, workspacePages, type DemoAppMeta, type DemoAppModule, type DemoPageId } from '@/demo/catalog'
import {
  attendanceMetrics,
  attendanceRows,
  candidateStages,
  employeeMetrics,
  employeeRecords,
  leaveMetrics,
  leaveRows,
  openWork,
  overviewMetrics,
  payrollMetrics,
  payrollRows,
  people,
  policies,
  policyMetrics,
  recruitmentMetrics,
  reportMetrics,
  reportRows,
} from '@/demo/mockData'
import {
  AppShell,
  Avatar,
  Badge,
  Eyebrow,
  TinyLink,
  demoMutedSurfaceClass,
  demoSmallSurfaceClass,
  demoSurfaceClass,
  type DemoPalette,
} from '@/demo/primitives'

type FamilyShellVariant = 'rail' | 'desk' | 'hybrid'
type WorkspacePageId = Exclude<DemoPageId, 'login'>
type ContentPageId = Exclude<DemoPageId, 'login' | 'dashboard'>
type MetricKey =
  | 'overview'
  | 'employee'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'recruitment'
  | 'report'
  | 'policy'

type FamilyDefinition = {
  appClassName: string
  icon: LucideIcon
  meta: DemoAppMeta
  home: {
    badge: string
    title: string
    description: string
    milestones: string[]
  }
  palette: DemoPalette
  pageCopy: Record<Exclude<DemoPageId, 'login' | 'dashboard'>, string>
  shell: FamilyShellVariant
  dashboardMetricKey: MetricKey
  supportLabel: string
  supportNotes: string[]
  workLabel: string
}

export function createMixedFamilyDemo(definition: FamilyDefinition): DemoAppModule {
  return {
    meta: definition.meta,
    renderPreview() {
      return (
        <AppShell className={definition.appClassName} palette={definition.palette}>
          {definition.shell === 'rail' ? <RailPreview /> : definition.shell === 'desk' ? <DeskPreview /> : <HybridPreview />}
        </AppShell>
      )
    },
    renderPage(pageId) {
      return (
        <AppShell className={definition.appClassName} palette={definition.palette}>
          {pageId === 'login' ? <FamilyLogin definition={definition} /> : <FamilyWorkspace definition={definition} pageId={pageId} />}
        </AppShell>
      )
    },
  }
}

function RailPreview() {
  return (
    <div className={`${demoSurfaceClass} overflow-hidden`}>
      <div className="grid min-h-[280px] grid-cols-[94px_minmax(0,1fr)]">
        <div className="border-r border-[var(--demo-border)] bg-[var(--demo-surface-muted)] p-4">
          <div className="h-8 w-8 rounded-2xl bg-[var(--demo-accent)]" />
          <div className="mt-6 space-y-2">
            <div className="h-2 rounded-full bg-white/90" />
            <div className="h-2 rounded-full bg-white/75" />
            <div className="h-2 rounded-full bg-white/60" />
          </div>
        </div>
        <div className="p-4">
          <div className="h-10 rounded-full bg-white/80" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((item) => (
              <div className="h-20 rounded-[22px] bg-white/90" key={item} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="h-28 rounded-[24px] bg-[linear-gradient(135deg,var(--demo-accent),var(--demo-accent-alt))]" />
            <div className="h-28 rounded-[24px] bg-[var(--demo-accent-soft)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function DeskPreview() {
  return (
    <div className={`${demoSurfaceClass} min-h-[280px] p-4`}>
      <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[var(--demo-surface-muted)] px-4 py-3">
        <div className="h-4 w-40 rounded-full bg-white" />
        <div className="h-8 w-28 rounded-full bg-[var(--demo-accent-soft)]" />
      </div>
      <div className="mt-4 grid gap-3">
        <div className="rounded-[26px] bg-[linear-gradient(135deg,var(--demo-accent),var(--demo-accent-alt))] p-4">
          <div className="h-5 w-3/5 rounded-full bg-white/70" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((item) => (
              <div className="h-16 rounded-[16px] bg-white/80" key={item} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div className="h-16 rounded-[16px] bg-white" key={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HybridPreview() {
  return (
    <div className={`${demoSurfaceClass} min-h-[280px] overflow-hidden p-4`}>
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((item) => (
          <div className="h-9 flex-1 rounded-full bg-[var(--demo-surface-muted)]" key={item} />
        ))}
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-[22px] bg-[var(--demo-surface-muted)] p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div className="h-12 rounded-[16px] bg-white" key={item} />
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-[24px] bg-[linear-gradient(135deg,var(--demo-accent),var(--demo-accent-alt))] p-4">
            <div className="h-5 w-2/3 rounded-full bg-white/75" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-24 rounded-[22px] bg-white" />
            <div className="h-24 rounded-[22px] bg-[var(--demo-accent-soft)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function FamilyWorkspace({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  if (definition.shell === 'rail') {
    return <RailWorkspace definition={definition} pageId={pageId} />
  }

  if (definition.shell === 'hybrid') {
    return <HybridWorkspace definition={definition} pageId={pageId} />
  }

  return <DeskWorkspace definition={definition} pageId={pageId} />
}

function RailWorkspace({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-6">
      <div className={`${demoSurfaceClass} overflow-hidden`}>
        <div className="grid min-h-[calc(100vh-3rem)] xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--demo-border)] bg-[var(--demo-surface-muted)] p-5 xl:border-b-0 xl:border-r">
            <RailAside definition={definition} pageId={pageId} />
          </aside>
          <div className="min-w-0 p-4 sm:p-5">
            {pageId === 'dashboard' ? (
              <DashboardHome definition={definition} />
            ) : (
              <div className="space-y-4">
                <RouteHeading definition={definition} pageId={pageId} />
                <RouteContent definition={definition} pageId={pageId} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DeskWorkspace({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  return (
    <div className="mx-auto max-w-[1520px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-4">
        <TopHeader definition={definition} pageId={pageId} />
        {pageId === 'dashboard' ? <DashboardHome definition={definition} /> : <RouteContent definition={definition} pageId={pageId} />}
        <FooterLinks definition={definition} />
      </div>
    </div>
  )
}

function HybridWorkspace({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  return (
    <div className="mx-auto max-w-[1520px] px-4 py-4 sm:px-6 sm:py-6">
      <div className="space-y-4">
        <TopHeader definition={definition} pageId={pageId} />
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <HybridSidebar definition={definition} pageId={pageId} />
          </aside>
          <div>{pageId === 'dashboard' ? <DashboardHome definition={definition} compact /> : <RouteContent definition={definition} pageId={pageId} />}</div>
        </div>
        <FooterLinks definition={definition} />
      </div>
    </div>
  )
}

function RailAside({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  const Icon = definition.icon

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--demo-accent)] text-white">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <Eyebrow>{definition.meta.title}</Eyebrow>
          <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">
            {definition.meta.tagline}
          </p>
        </div>
      </div>
      <div className={`${demoSmallSurfaceClass} mt-6 p-4`}>
        <Eyebrow>{definition.home.badge}</Eyebrow>
        <p className="mt-2 text-sm font-semibold text-[var(--demo-ink)]">{definition.home.milestones[0]}</p>
        <div className="mt-3 h-2 rounded-full bg-white">
          <div className="h-2 w-[82%] rounded-full bg-[var(--demo-accent)]" />
        </div>
      </div>
      <nav className="mt-6 space-y-1.5">
        {workspacePages.map((item) => (
          <a
            className={[
              'flex items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-semibold',
              item.id === pageId ? 'bg-white text-[var(--demo-ink)] shadow-[inset_3px_0_0_var(--demo-accent)]' : 'text-slate-600',
            ].join(' ')}
            href={demoHref(definition.meta.id, item.id)}
            key={item.id}
          >
            <item.icon className="h-4.5 w-4.5" />
            {item.title}
          </a>
        ))}
      </nav>
      <div className="mt-8 flex flex-wrap gap-2">
        <TinyLink to={demoHref(definition.meta.id, 'login')}>Login</TinyLink>
        <TinyLink to="/demos">Gallery</TinyLink>
      </div>
    </>
  )
}

function TopHeader({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  const page = getDemoPage(pageId)
  const heading = pageId === 'dashboard' ? definition.home.title : page.title

  return (
    <header className={`${demoSurfaceClass} p-5`}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Eyebrow>{definition.meta.tagline}</Eyebrow>
          <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)] sm:text-[2.5rem]">
            {heading}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            {pageId === 'dashboard' ? definition.home.description : definition.pageCopy[pageId]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workspacePages.map((item) => (
            <a
              className={[
                'rounded-full px-3 py-2 text-[13px] font-semibold',
                item.id === pageId ? 'bg-[var(--demo-accent)] text-white' : 'bg-[var(--demo-surface-muted)] text-slate-700',
              ].join(' ')}
              href={demoHref(definition.meta.id, item.id)}
              key={item.id}
            >
              {item.shortTitle}
            </a>
          ))}
        </div>
      </div>
    </header>
  )
}

function HybridSidebar({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: WorkspacePageId
}) {
  const page = getDemoPage(pageId)

  return (
    <>
      <section className={`${demoSurfaceClass} p-5`}>
        <Eyebrow>{definition.workLabel}</Eyebrow>
        <div className="mt-4 space-y-3">
          {definition.home.milestones.map((item, index) => (
            <div className={`${demoMutedSurfaceClass} p-4`} key={item}>
              <div className="flex items-center gap-2">
                <Badge tone={index === 0 ? 'warning' : index === 1 ? 'info' : 'success'}>
                  {index === 0 ? 'Now' : index === 1 ? 'Soon' : 'Ready'}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-[var(--demo-ink)]">{item}</p>
            </div>
          ))}
        </div>
      </section>
      <section className={`${demoSurfaceClass} p-5`}>
        <Eyebrow>{page.shortTitle} queue</Eyebrow>
        <div className="mt-4 space-y-3">
          {definition.supportNotes.slice(0, 3).map((note) => (
            <div className={`${demoMutedSurfaceClass} p-4`} key={note}>
              <p className="text-sm leading-6 text-slate-600">{note}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function DashboardHome({
  compact = false,
  definition,
}: {
  compact?: boolean
  definition: FamilyDefinition
}) {
  const metricItems = metricSet(definition.dashboardMetricKey)

  return (
    <div className="space-y-4">
      <section className={`${demoSurfaceClass} overflow-hidden p-6`}>
        <div className={`grid gap-4 ${compact ? 'lg:grid-cols-[1fr]' : 'lg:grid-cols-[1.1fr_0.9fr]'}`}>
          <div className="rounded-[30px] bg-[linear-gradient(135deg,var(--demo-accent),var(--demo-accent-alt))] p-6 text-white shadow-[0_26px_50px_rgba(79,56,163,0.16)]">
            <Eyebrow className="text-white/70">{definition.home.badge}</Eyebrow>
            <h2 className="mt-3 text-[2.3rem] font-semibold tracking-[-0.06em] sm:text-[3rem]">
              {definition.home.title}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/82">{definition.home.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {definition.home.milestones.map((item) => (
                <span className="rounded-full bg-white/14 px-3 py-2 text-[13px] font-semibold text-white" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
          {!compact ? (
            <div className="grid gap-4">
              <div className={`${demoMutedSurfaceClass} rounded-[26px] p-5`}>
                <Eyebrow>{definition.workLabel}</Eyebrow>
                <div className="mt-4 space-y-3">
                  {definition.supportNotes.slice(0, 2).map((note) => (
                    <div className="rounded-[18px] bg-white px-4 py-4" key={note}>
                      <p className="text-sm leading-6 text-slate-600">{note}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${demoSurfaceClass} rounded-[26px] p-5`}>
                <Eyebrow>{definition.supportLabel}</Eyebrow>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--demo-accent-soft)] text-[var(--demo-accent-strong)]">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm leading-6 text-slate-600">
                    The dashboard keeps the warmer welcome framing while the rest of the product shifts back into an operational workspace.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className={`${demoSurfaceClass} rounded-[30px] p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metricItems.map((item) => (
            <div className={`${demoMutedSurfaceClass} rounded-[24px] p-4`} key={item.label}>
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)]">{item.value}</p>
              <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="space-y-4">
          <section className={`${demoSurfaceClass} rounded-[26px] p-5`}>
            <Eyebrow>{definition.workLabel}</Eyebrow>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[
                {
                  title: definition.home.milestones[0],
                  detail: definition.pageCopy.employees,
                },
                {
                  title: definition.home.milestones[1],
                  detail: definition.pageCopy.reports,
                },
              ].map((item) => (
                <div className={`${demoMutedSurfaceClass} rounded-[22px] p-5`} key={item.title}>
                  <p className="font-semibold text-[var(--demo-ink)]">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </section>
          <section className={`${demoSurfaceClass} rounded-[26px] p-5`}>
            <Eyebrow>People and policy snapshots</Eyebrow>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className={`${demoMutedSurfaceClass} rounded-[22px] p-5`}>
                <Eyebrow>People</Eyebrow>
                <div className="mt-4 space-y-3">
                  {people.slice(0, 3).map((person) => (
                    <div className="flex items-start gap-3" key={person.email}>
                      <Avatar name={person.name} />
                      <div>
                        <p className="font-semibold text-[var(--demo-ink)]">{person.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{person.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`${demoMutedSurfaceClass} rounded-[22px] p-5`}>
                <Eyebrow>Open work</Eyebrow>
                <div className="mt-4 space-y-3">
                  {openWork.map((item) => (
                    <div className="rounded-[18px] bg-white px-4 py-4" key={item.title}>
                      <p className="font-semibold text-[var(--demo-ink)]">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-4">
          <section className={`${demoSurfaceClass} rounded-[26px] p-5`}>
            <Eyebrow>Milestone rail</Eyebrow>
            <div className="mt-4 space-y-3">
              {definition.home.milestones.map((item, index) => (
                <div className={`${demoMutedSurfaceClass} rounded-[22px] p-4`} key={item}>
                  <div className="flex items-center gap-2">
                    <Badge tone={index === 0 ? 'warning' : index === 1 ? 'info' : 'success'}>
                      {index === 0 ? 'Now' : index === 1 ? 'Soon' : 'Open'}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-medium text-[var(--demo-ink)]">{item}</p>
                </div>
              ))}
            </div>
          </section>
          <FooterLinks definition={definition} />
        </aside>
      </div>
    </div>
  )
}

function RouteHeading({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: ContentPageId
}) {
  const page = getDemoPage(pageId)

  return (
    <section className={`${demoSurfaceClass} p-5`}>
      <Eyebrow>{definition.meta.tagline}</Eyebrow>
      <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)] sm:text-[2.4rem]">
        {page.title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">{definition.pageCopy[pageId]}</p>
    </section>
  )
}

function RouteContent({
  definition,
  pageId,
}: {
  definition: FamilyDefinition
  pageId: ContentPageId
}) {
  const items = metricSet(pageMetricKey(pageId))

  return (
    <div className="space-y-4">
      {definition.shell !== 'rail' ? <RouteHeading definition={definition} pageId={pageId} /> : null}
      <section className={`${demoSurfaceClass} p-5`}>
        <Eyebrow>{definition.workLabel}</Eyebrow>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div className={`${demoMutedSurfaceClass} p-4`} key={item.label}>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--demo-muted)]">{item.label}</p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)]">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
      {pageId === 'directory' ? (
        <DirectorySection />
      ) : pageId === 'recruitment' ? (
        <RecruitmentSection />
      ) : pageId === 'policies' ? (
        <PolicySection />
      ) : (
        <TableSection pageId={pageId} supportLabel={definition.supportLabel} supportNotes={definition.supportNotes} />
      )}
    </div>
  )
}

function DirectorySection() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className={`${demoSurfaceClass} p-5`}>
        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--demo-surface-muted)] px-4 py-3 text-sm text-slate-400">
          <Search className="h-4 w-4 text-slate-400" />
          Search by name, team, manager, or site
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((person) => (
            <article className={`${demoMutedSurfaceClass} p-5`} key={person.email}>
              <div className="flex items-start gap-4">
                <Avatar name={person.name} />
                <div>
                  <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{person.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{person.role}</p>
                  <p className="mt-3 text-sm text-slate-500">{person.team}</p>
                  <p className="mt-1 text-sm font-medium text-[var(--demo-accent-strong)]">{person.email}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <section className={`${demoSurfaceClass} p-5`}>
          <Eyebrow>Search dock</Eyebrow>
          <div className="mt-4 space-y-3">
            {['Department filters', 'Manager view', 'Office coverage', 'Staffing gaps'].map((item) => (
              <div className={`${demoMutedSurfaceClass} p-4`} key={item}>
                <p className="text-sm font-medium text-[var(--demo-ink)]">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function RecruitmentSection() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className={`${demoSurfaceClass} p-5`}>
        <div className="grid gap-4 xl:grid-cols-4">
          {candidateStages.map((stage) => (
            <div className={`${demoMutedSurfaceClass} p-4`} key={stage.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--demo-ink)]">{stage.label}</p>
                <Badge tone="info">{stage.count}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {stage.cards.map((card) => (
                  <div className="rounded-[18px] bg-white p-3 shadow-[0_10px_18px_rgba(15,23,42,0.05)]" key={card}>
                    <p className="font-semibold text-[var(--demo-ink)]">{card}</p>
                    <p className="mt-1 text-sm text-slate-600">Ready for the next handoff.</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <section className={`${demoSurfaceClass} p-5`}>
          <Eyebrow>Hiring room</Eyebrow>
          <div className="mt-4 space-y-3">
            {[
              'Panel feedback due today',
              'Salary band alignment pending',
              'Candidate updates ready to send',
            ].map((item) => (
              <div className={`${demoMutedSurfaceClass} p-4`} key={item}>
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function PolicySection() {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className={`${demoSurfaceClass} p-5`}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((policy) => (
            <article className={`${demoMutedSurfaceClass} p-4`} key={policy.title}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--demo-accent-strong)]">
                  <BookOpen className="h-4.5 w-4.5" />
                </div>
                <Badge tone="info">{policy.version}</Badge>
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{policy.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{policy.detail}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--demo-muted)]">{policy.owner}</p>
            </article>
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <section className={`${demoSurfaceClass} p-5`}>
          <Eyebrow>Reading aids</Eyebrow>
          <div className="mt-4 space-y-3">
            {['Mandatory rollout', 'Unread acknowledgements', 'Related guidance', 'Owner notes'].map((item) => (
              <div className={`${demoMutedSurfaceClass} p-4`} key={item}>
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function TableSection({
  pageId,
  supportLabel,
  supportNotes,
}: {
  pageId: Exclude<ContentPageId, 'directory' | 'recruitment' | 'policies'>
  supportLabel: string
  supportNotes: string[]
}) {
  const spec = tableSpec(pageId)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className={`${demoSurfaceClass} overflow-hidden`}>
        <table className="min-w-full">
          <thead className="bg-[var(--demo-surface-muted)]">
            <tr>
              {spec.headers.map((header) => (
                <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.18em] text-[var(--demo-muted)]" key={header}>
                  {header}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.18em] text-[var(--demo-muted)]">State</th>
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((row, index) => (
              <tr className="border-t border-[var(--demo-border)]" key={row.join('-')}>
                {row.map((cell) => (
                  <td className="px-4 py-3 text-sm text-slate-700" key={`${row[0]}-${cell}`}>
                    {cell}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  <Badge tone={index % 3 === 0 ? 'warning' : index % 3 === 1 ? 'info' : 'success'}>
                    {index % 3 === 0 ? 'Review' : index % 3 === 1 ? 'Queued' : 'Ready'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <aside className="space-y-4">
        <section className={`${demoSurfaceClass} p-5`}>
          <Eyebrow>{supportLabel}</Eyebrow>
          <div className="mt-4 space-y-3">
            {supportNotes.map((note) => (
              <div className={`${demoMutedSurfaceClass} p-4`} key={note}>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[var(--demo-accent-strong)]" />
                  <p className="text-sm leading-6 text-slate-600">{note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

function FamilyLogin({
  definition,
}: {
  definition: FamilyDefinition
}) {
  const Icon = definition.icon

  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.1fr)_460px]">
      <section className={`${demoSurfaceClass} p-8`}>
        <Eyebrow>{definition.home.badge}</Eyebrow>
        <h1 className="mt-4 max-w-3xl text-[2.7rem] font-semibold tracking-[-0.06em] text-[var(--demo-ink)] sm:text-[3.9rem]">
          {definition.home.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{definition.home.description}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {metricSet(definition.dashboardMetricKey).slice(0, 3).map((item) => (
            <div className={`${demoMutedSurfaceClass} p-4`} key={item.label}>
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-[var(--demo-ink)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className={`${demoSurfaceClass} p-8`}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--demo-accent-soft)] text-[var(--demo-accent-strong)]">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <Eyebrow>Access</Eyebrow>
            <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{definition.meta.title}</p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <AuthField label="Email" value="tania@rakss.ae" />
          <AuthField label="Password" value="••••••••••••" />
          <div className="rounded-[20px] bg-[var(--demo-accentStrong)] px-4 py-4 text-center text-sm font-semibold text-white">
            Open {definition.meta.title}
          </div>
        </div>
      </section>
    </div>
  )
}

function AuthField({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${demoMutedSurfaceClass} p-4`}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-2 text-sm font-medium text-[var(--demo-ink)]">{value}</p>
    </div>
  )
}

function FooterLinks({ definition }: { definition: FamilyDefinition }) {
  return (
    <div className="flex gap-2">
      <TinyLink to={demoHref(definition.meta.id, 'login')}>Login</TinyLink>
      <TinyLink to="/demos">Gallery</TinyLink>
    </div>
  )
}

function metricSet(key: MetricKey) {
  if (key === 'employee') return employeeMetrics
  if (key === 'attendance') return attendanceMetrics
  if (key === 'leave') return leaveMetrics
  if (key === 'payroll') return payrollMetrics
  if (key === 'recruitment') return recruitmentMetrics
  if (key === 'report') return reportMetrics
  if (key === 'policy') return policyMetrics
  return overviewMetrics
}

function pageMetricKey(pageId: Exclude<DemoPageId, 'dashboard' | 'login'>): MetricKey {
  if (pageId === 'employees') return 'employee'
  if (pageId === 'attendance') return 'attendance'
  if (pageId === 'leave') return 'leave'
  if (pageId === 'payroll') return 'payroll'
  if (pageId === 'recruitment') return 'recruitment'
  if (pageId === 'reports') return 'report'
  if (pageId === 'policies') return 'policy'
  return 'overview'
}

function tableSpec(pageId: Exclude<DemoPageId, 'dashboard' | 'directory' | 'recruitment' | 'policies' | 'login'>) {
  if (pageId === 'employees') {
    return {
      headers: ['Employee', 'Department', 'Join date', 'Access'],
      rows: employeeRecords,
    }
  }

  if (pageId === 'attendance') {
    return {
      headers: ['Employee', 'Site', 'Check in', 'Shift'],
      rows: attendanceRows,
    }
  }

  if (pageId === 'leave') {
    return {
      headers: ['Type', 'Eligibility', 'Carry over', 'Rule'],
      rows: leaveRows,
    }
  }

  if (pageId === 'payroll') {
    return {
      headers: ['Employee', 'Cycle item', 'Delta', 'Owner'],
      rows: payrollRows,
    }
  }

  return {
    headers: ['Department', 'Attrition', 'Open roles', 'Context'],
    rows: reportRows,
  }
}
