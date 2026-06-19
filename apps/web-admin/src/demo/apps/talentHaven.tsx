import { Briefcase, CalendarDays, Clock3, FileText, Search, ShieldCheck, Users } from 'lucide-react'

import { demoHref, getDemoPage, workspacePages, type DemoAppModule, type DemoPageId } from '@/demo/catalog'
import {
  attendanceMetrics,
  attendanceRows,
  calendarNotes,
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
import { AppShell, Avatar, Badge, Eyebrow, NavChip, TinyLink, demoMutedSurfaceClass, demoSmallSurfaceClass, demoSurfaceClass, type DemoPalette } from '@/demo/primitives'

const palette: DemoPalette = {
  accent: '#c96442',
  accentStrong: '#7c3d28',
  accentSoft: '#f0e6dc',
  accentAlt: '#e4eadc',
  bgStart: '#f5f4ed',
  bgEnd: '#f5f4ed',
  surface: 'rgba(250,249,245,0.96)',
  surfaceMuted: 'rgba(240,238,230,0.94)',
  border: 'rgba(232,230,220,0.96)',
  ink: '#141413',
  muted: '#5e5d59',
}

const meta = {
  id: 'talent-haven',
  title: 'Talent Haven',
  summary: 'Calm people workspace with parchment surfaces, editorial hierarchy, and people-first HR pacing.',
  tagline: 'Soft left-rail people workspace',
  spectrum: 'grounded' as const,
}

export const talentHavenDemo: DemoAppModule = {
  meta,
  renderPreview() {
    return (
      <AppShell className="demo-app demo-app--talent-haven bg-[#f5f4ed]" palette={palette}>
        <div className={`${demoSurfaceClass} overflow-hidden`}>
          <div className="grid min-h-[280px] grid-cols-[92px_minmax(0,1fr)]">
            <div className="border-r border-[var(--demo-border)] bg-[var(--demo-surface-muted)] p-4">
              <div className="h-8 w-8 rounded-2xl bg-[var(--demo-accent)]" />
              <div className="mt-6 space-y-2">
                <div className="h-2 rounded-full bg-white/90" />
                <div className="h-2 rounded-full bg-white/80" />
                <div className="h-2 rounded-full bg-white/70" />
              </div>
            </div>
            <div className="p-4">
              <div className="h-10 rounded-full bg-white/80" />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="h-20 rounded-[22px] bg-white/90" />
                <div className="h-20 rounded-[22px] bg-white/80" />
                <div className="h-20 rounded-[22px] bg-white/70" />
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                <div className="h-28 rounded-[24px] bg-white/88" />
                <div className="h-28 rounded-[24px] bg-[var(--demo-accent-soft)]" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    )
  },
  renderPage(pageId) {
    return (
      <AppShell className="demo-app demo-app--talent-haven bg-[#f5f4ed]" palette={palette}>
        {pageId === 'login' ? <TalentLogin /> : <TalentWorkspace pageId={pageId} />}
      </AppShell>
    )
  },
}

function TalentWorkspace({ pageId }: { pageId: DemoPageId }) {
  const page = getDemoPage(pageId)

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-6">
      <div className={`${demoSurfaceClass} overflow-hidden`}>
        <div className="grid min-h-[calc(100vh-3rem)] xl:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="border-b border-[var(--demo-border)] bg-[var(--demo-surface-muted)] p-5 xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--demo-accent)] text-white">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <Eyebrow>Talent Haven</Eyebrow>
                <p className="mt-1 text-base font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">People workspace</p>
              </div>
            </div>
            <div className={`${demoSmallSurfaceClass} mt-6 p-4`}>
              <Eyebrow>Setup</Eyebrow>
              <p className="mt-2 text-sm font-semibold text-[var(--demo-ink)]">Company setup is 84% complete</p>
              <div className="mt-3 h-2 rounded-full bg-white">
                <div className="h-2 w-[84%] rounded-full bg-[var(--demo-accent)]" />
              </div>
            </div>
            <nav className="mt-6 space-y-1.5">
              {workspacePages.map((item) => (
                <a
                  className={[
                    'flex items-center gap-3 rounded-[18px] px-3 py-3 text-sm font-semibold',
                    item.id === pageId ? 'bg-white text-[var(--demo-ink)] shadow-[inset_3px_0_0_var(--demo-accent)]' : 'text-slate-600',
                  ].join(' ')}
                  href={demoHref(meta.id, item.id)}
                  key={item.id}
                >
                  <item.icon className="h-4.5 w-4.5" />
                  {item.title}
                </a>
              ))}
            </nav>
            <div className="mt-8 flex flex-wrap gap-2">
              <TinyLink to={demoHref(meta.id, 'login')}>Login</TinyLink>
              <TinyLink to="/demos">Gallery</TinyLink>
            </div>
          </aside>
          <div className="min-w-0 p-4 sm:p-5">
            <section className={`${demoSurfaceClass} p-5`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <Eyebrow>{meta.tagline}</Eyebrow>
                  <h1 className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)] sm:text-[2.6rem]">{page.title}</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{descriptions[pageId]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <NavChip active to={demoHref(meta.id, pageId)}>{page.shortTitle}</NavChip>
                  <NavChip to={demoHref(meta.id, 'dashboard')}>Overview</NavChip>
                </div>
              </div>
            </section>
            <div className="mt-4">{renderTalentPage(pageId)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TalentLogin() {
  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1.05fr)_520px]">
      <section className={`${demoSurfaceClass} p-8`}>
        <Eyebrow>HR entry</Eyebrow>
        <h1 className="mt-4 max-w-2xl text-[2.7rem] font-semibold tracking-[-0.07em] text-[var(--demo-ink)] sm:text-[4rem]">
          A calmer login for a calmer people workspace.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">Trust cues, daily priorities, and role context belong on the login route when the product is operational and people-facing.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className={`${demoSmallSurfaceClass} p-4`}>
            <p className="font-semibold text-[var(--demo-ink)]">Today&apos;s focus</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Approvals, payroll cutoffs, and onboarding tasks are visible before sign in.</p>
          </div>
          <div className={`${demoSmallSurfaceClass} p-4`}>
            <p className="font-semibold text-[var(--demo-ink)]">Support cues</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">SSO readiness, session protection, and people operations context stay close to the form.</p>
          </div>
        </div>
      </section>
      <section className={`${demoSurfaceClass} p-8`}>
        <Eyebrow>Account access</Eyebrow>
        <h2 className="mt-2 text-[2.1rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)]">Welcome back, Tania</h2>
        <div className="mt-6 space-y-4">
          <div className={`${demoSmallSurfaceClass} p-4`}><Eyebrow>Email</Eyebrow><p className="mt-2 text-sm font-medium text-[var(--demo-ink)]">tania@rakss.ae</p></div>
          <div className={`${demoSmallSurfaceClass} p-4`}><Eyebrow>Password</Eyebrow><p className="mt-2 text-sm font-medium text-slate-400">••••••••••••</p></div>
          <div className="rounded-[22px] bg-[var(--demo-accent)] px-4 py-4 text-center text-sm font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.14)]">Sign in to Talent Haven</div>
        </div>
      </section>
    </div>
  )
}

function renderTalentPage(pageId: DemoPageId) {
  if (pageId === 'dashboard') {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <MetricGrid items={overviewMetrics} />
          <SimpleList title="Open work" items={openWork} />
        </div>
        <div className="space-y-4">
          <CalendarCard />
          <SmallPanel title="Upcoming leave">
            <p className="text-sm leading-6 text-slate-600">Helena Brauer, Ingo Schimpff, and Kandro Lowe are all out next week.</p>
          </SmallPanel>
        </div>
      </div>
    )
  }

  if (pageId === 'employees') {
    return (
      <div className="space-y-4">
        <MetricGrid items={employeeMetrics} />
        <CardBlock title="Onboarding lanes">
          <div className="grid gap-4 md:grid-cols-3">
            <ActionTile icon={Users} title="Create employee record" detail="Identity, employment type, and manager context." />
            <ActionTile icon={Search} title="Assign title & team" detail="Keep department and designation close to setup." />
            <ActionTile icon={ShieldCheck} title="Provision access" detail="Employee login or manager permissions in one flow." />
          </div>
        </CardBlock>
        <TalentTable rows={employeeRecords} headers={['Employee', 'Department', 'Join date', 'Access']} />
      </div>
    )
  }

  if (pageId === 'directory') {
    return (
      <div className="space-y-4">
        <CardBlock title="Search people"><div className={`${demoMutedSurfaceClass} p-4 text-sm text-slate-400`}>Fatima Al Suwaidi, employee ID, finance, or recruiter</div></CardBlock>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{people.map((person) => <PersonCard key={person.email} {...person} />)}</div>
      </div>
    )
  }

  if (pageId === 'attendance') {
    return <OpsPage metrics={attendanceMetrics} rows={attendanceRows} headers={['Employee', 'Site', 'Check in', 'Shift']} title="Location performance" icon={Clock3} />
  }

  if (pageId === 'leave') {
    return <OpsPage metrics={leaveMetrics} rows={leaveRows} headers={['Type', 'Eligibility', 'Carry over', 'Manager rule']} title="Request review" icon={CalendarDays} />
  }

  if (pageId === 'payroll') {
    return <OpsPage metrics={payrollMetrics} rows={payrollRows} headers={['Employee', 'Cycle item', 'Delta', 'Owner']} title="Cycle review" icon={FileText} />
  }

  if (pageId === 'recruitment') {
    return (
      <div className="space-y-4">
        <MetricGrid items={recruitmentMetrics} />
        <CardBlock title="Hiring board">
          <div className="grid gap-4 xl:grid-cols-4">
            {candidateStages.map((stage) => (
              <div className={`${demoMutedSurfaceClass} p-4`} key={stage.label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--demo-ink)]">{stage.label}</p>
                  <Badge tone="info">{stage.count}</Badge>
                </div>
                <div className="mt-4 space-y-3">
                  {stage.cards.map((card) => (
                    <div className={`${demoSmallSurfaceClass} p-3`} key={card}>
                      <p className="font-semibold text-[var(--demo-ink)]">{card}</p>
                      <p className="mt-1 text-sm text-slate-600">Ready for the next hiring handoff.</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardBlock>
      </div>
    )
  }

  if (pageId === 'reports') {
    return (
      <div className="space-y-4">
        <MetricGrid items={reportMetrics} />
        <CardBlock title="People movement and governance"><TalentTable rows={reportRows} headers={['Department', 'New hires', 'Open roles', 'Readiness']} /></CardBlock>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <MetricGrid items={policyMetrics} />
      <CardBlock title="Published collection">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{policies.map((policy) => <PolicyCard key={policy.title} {...policy} />)}</div>
      </CardBlock>
    </div>
  )
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string; detail: string }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div className={`${demoSurfaceClass} p-4`} key={item.label}>
          <p className="text-sm font-medium text-slate-500">{item.label}</p>
          <p className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em] text-[var(--demo-ink)]">{item.value}</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function CardBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className={`${demoSurfaceClass} p-5`}><h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{title}</h2><div className="mt-4">{children}</div></section>
}

function SimpleList({
  items,
  title,
}: {
  items: Array<{ title: string; subtitle: string; meta: string; badge: string; tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' }>
  title: string
}) {
  return (
    <CardBlock title={title}>
      <div className="space-y-3">
        {items.map((item) => (
          <div className={`${demoSmallSurfaceClass} flex items-center justify-between gap-4 p-4`} key={item.title}>
            <div><p className="font-semibold text-[var(--demo-ink)]">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.subtitle}</p></div>
            <div className="flex items-center gap-2"><span className="text-sm font-medium text-slate-500">{item.meta}</span><Badge tone={item.tone}>{item.badge}</Badge></div>
          </div>
        ))}
      </div>
    </CardBlock>
  )
}

function CalendarCard() {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
  return (
    <section className={`${demoSurfaceClass} p-5`}>
      <h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">This week</h2>
      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.slice(0, 14).map((day) => <div className="flex h-9 items-center justify-center rounded-[16px] bg-[var(--demo-surface-muted)] text-sm font-medium text-slate-600" key={day}>{day}</div>)}
      </div>
      <div className="mt-4 space-y-2">{calendarNotes.map((note) => <div className="text-sm text-slate-600" key={note}>• {note}</div>)}</div>
    </section>
  )
}

function SmallPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className={`${demoSurfaceClass} p-5`}><h2 className="text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{title}</h2><div className="mt-4">{children}</div></section>
}

function ActionTile({ detail, icon: Icon, title }: { detail: string; icon: typeof Users; title: string }) {
  return <div className={`${demoSmallSurfaceClass} p-4`}><div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[var(--demo-accent-soft)] text-[var(--demo-accent-strong)]"><Icon className="h-4.5 w-4.5" /></div><p className="mt-4 font-semibold text-[var(--demo-ink)]">{title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></div>
}

function TalentTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className={`${demoSurfaceClass} overflow-hidden`}>
      <table className="min-w-full">
        <thead className="bg-[var(--demo-surface-muted)]">
          <tr>{headers.map((header) => <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500" key={header}>{header}</th>)}<th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</th></tr>
        </thead>
        <tbody>{rows.map((row, index) => <tr className="border-t border-[var(--demo-border)]" key={row.join('-')}>{row.map((cell) => <td className="px-4 py-3 text-sm text-slate-700" key={`${row[0]}-${cell}`}>{cell}</td>)}<td className="px-4 py-3 text-right"><Badge tone={index % 3 === 0 ? 'warning' : index % 3 === 1 ? 'success' : 'neutral'}>{index % 3 === 0 ? 'Review' : index % 3 === 1 ? 'Ready' : 'Open'}</Badge></td></tr>)}</tbody>
      </table>
    </div>
  )
}

function PersonCard(person: { email: string; name: string; role: string; team: string }) {
  return <div className={`${demoSurfaceClass} p-5`}><div className="flex items-start gap-4"><Avatar name={person.name} /><div><p className="text-lg font-semibold tracking-[-0.03em] text-[var(--demo-ink)]">{person.name}</p><p className="mt-1 text-sm text-slate-600">{person.role}</p><p className="mt-3 text-sm text-slate-500">{person.team}</p><p className="mt-1 text-sm font-medium text-[var(--demo-accent-strong)]">{person.email}</p></div></div></div>
}

function OpsPage({
  headers,
  icon: Icon,
  metrics,
  rows,
  title,
}: {
  headers: string[]
  icon: typeof Briefcase
  metrics: Array<{ label: string; value: string; detail: string }>
  rows: string[][]
  title: string
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <MetricGrid items={metrics} />
        <CardBlock title={title}><TalentTable headers={headers} rows={rows} /></CardBlock>
      </div>
      <div className="space-y-4">
        <section className={`${demoSurfaceClass} p-5`}><div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--demo-accent-soft)] text-[var(--demo-accent-strong)]"><Icon className="h-4.5 w-4.5" /></div><p className="mt-4 font-semibold text-[var(--demo-ink)]">Action rail</p><p className="mt-2 text-sm leading-6 text-slate-600">Use the side rail for the exceptions or guidance the operator actually needs.</p></section>
        <CalendarCard />
      </div>
    </div>
  )
}

function PolicyCard(policy: { detail: string; owner: string; title: string; version: string }) {
  return <div className={`${demoSmallSurfaceClass} p-4`}><div className="flex items-center justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--demo-accent-soft)] text-[var(--demo-accent-strong)]"><FileText className="h-4.5 w-4.5" /></div><Badge tone="info">{policy.version}</Badge></div><p className="mt-4 font-semibold text-[var(--demo-ink)]">{policy.title}</p><p className="mt-2 text-sm leading-6 text-slate-600">{policy.detail}</p><p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{policy.owner}</p></div>
}

const descriptions: Record<DemoPageId, string> = {
  login: 'Login preview for the Talent Haven system.',
  dashboard: 'A softer daily HR surface with approvals, coverage, and people updates.',
  employees: 'Employee setup, access, and team structure in a guided workspace.',
  directory: 'A people directory that keeps role and team context visible.',
  attendance: 'Attendance operations with enough structure for HR teams to work quickly.',
  leave: 'Leave review with policy context and practical decision support.',
  payroll: 'Payroll timing and cycle review without losing the human context.',
  recruitment: 'Candidate flow with a calm HR presentation instead of a generic pipeline kit.',
  reports: 'A quiet reporting surface for leadership and workforce visibility.',
  policies: 'Policy publishing and document governance in the same visual system.',
}
