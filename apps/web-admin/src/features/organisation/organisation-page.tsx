import { useQuery } from '@apollo/client'
import { Building2, Briefcase, MapPin, Network } from 'lucide-react'
import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { toast } from '@/lib/toast'
import { PageIntro, SectionHeading } from '@/features/shared/page-intro'
import { useReferenceData, useSiteAssignments } from '@/features/shared/reference-data'
import { canManageAccounts, useAdminSession } from '@/lib/auth-session'
import { cn } from '@/lib/utils'

import { CompanySection } from './company-section'
import { ORGANISATION_PEOPLE_QUERY } from './graphql'
import { SitesSection } from './sites-section'
import { DepartmentsSection, DesignationsSection } from './structure-sections'

type PersonRef = { id: string; departmentId: string; designationId: string; isActive: boolean }

const SECTIONS = [
  { id: 'company', label: 'Company', icon: Building2 },
  { id: 'departments', label: 'Departments', icon: Network },
  { id: 'designations', label: 'Designations', icon: Briefcase },
  { id: 'sites', label: 'Work sites', icon: MapPin },
] as const

export function OrganisationPage() {
  const { account } = useAdminSession()
  const canEdit = canManageAccounts(account)
  const location = useLocation()
  const reference = useReferenceData()
  const peopleQuery = useQuery<{ employees: PersonRef[] }>(ORGANISATION_PEOPLE_QUERY)

  const activePeople = useMemo(
    () => (peopleQuery.data?.employees ?? []).filter((person) => person.isActive),
    [peopleQuery.data],
  )
  const assignments = useSiteAssignments(activePeople.map((person) => person.id))

  const countBy = (key: 'departmentId' | 'designationId') => (id: string) =>
    activePeople.filter((person) => person[key] === id).length

  const peopleAt = (siteId: string) => {
    if (peopleQuery.data && activePeople.length === 0) return 0
    if (!assignments.data) return null
    let count = 0
    assignments.byEmployee.forEach((rows) => {
      if (rows.some((row) => row.location.id === siteId)) count += 1
    })
    return count
  }

  const onNotice = (message: ReactNode, tone: 'success' | 'danger') =>
    tone === 'success' ? toast.success(message) : toast.error(message)

  useEffect(() => {
    if (!location.hash || reference.loading) return
    const target = document.getElementById(location.hash.slice(1))
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, reference.loading])

  const counts: Record<string, string | null> = {
    company: reference.companySettings ? null : 'Set up',
    departments: String(reference.departments.filter((d) => d.isActive).length),
    designations: String(reference.designations.filter((d) => d.isActive).length),
    sites: String(reference.sites.filter((s) => s.isActive).length),
  }

  return (
    <div className="space-y-5">
      <PageIntro
        description="Company details, how the team is structured, and the places people work."
        title="Organisation"
      />

      {reference.error ? (
        <Notice tone="danger">Organisation details could not be loaded. {reference.error.message}</Notice>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Organisation sections" className="lg:sticky lg:top-[92px] lg:self-start">
          <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SECTIONS.map((section) => (
              <li className="shrink-0" key={section.id}>
                <a
                  className={cn(
                    'flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-border/70 bg-card/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground lg:border-transparent lg:bg-transparent',
                    location.hash === `#${section.id}` && 'text-foreground lg:bg-card lg:border-border/70',
                  )}
                  href={`#${section.id}`}
                >
                  <section.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{section.label}</span>
                  {counts[section.id] ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs tabular-nums',
                        counts[section.id] === 'Set up'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {counts[section.id]}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <OrgSection
            description="Used on payslips, reports and for the default currency and time zone."
            id="company"
            title="Company"
          >
            {reference.loading && !reference.data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <CompanySection canEdit={canEdit} settings={reference.companySettings} />
            )}
          </OrgSection>

          <OrgSection
            description="Teams people belong to. Deactivating one keeps history but hides it from new records."
            id="departments"
            title="Departments"
          >
            <DepartmentsSection
              canEdit={canEdit}
              departments={reference.departments}
              onNotice={onNotice}
              peopleIn={countBy('departmentId')}
            />
          </OrgSection>

          <OrgSection
            description="Job titles inside each department, ordered by level."
            id="designations"
            title="Designations"
          >
            <DesignationsSection
              canEdit={canEdit}
              departments={reference.departments}
              designations={reference.designations}
              onNotice={onNotice}
              peopleIn={countBy('designationId')}
            />
          </OrgSection>

          <OrgSection
            description="Places where people clock in and out. Assign people to a site from People."
            id="sites"
            title="Work sites"
          >
            <SitesSection
              canEdit={canEdit}
              defaultCountry={reference.companySettings?.countryCode ?? 'AE'}
              onNotice={onNotice}
              peopleAt={peopleAt}
              sites={reference.sites}
            />
          </OrgSection>
        </div>
      </div>
    </div>
  )
}

function OrgSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-24" id={id}>
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <SectionHeading description={description} id={`${id}-heading`} title={title} />
          {children}
        </CardContent>
      </Card>
    </section>
  )
}
