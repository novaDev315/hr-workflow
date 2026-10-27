import { lazy, type ComponentType } from 'react'

type PageModule = { default: ComponentType }

// A route page that downloads on first use, and can also be downloaded ahead
// of time with `preload`. Once downloaded, the page is handed to React
// synchronously, so opening it renders straight away instead of showing the
// loading state for a frame.
function lazyPage(load: () => Promise<ComponentType>) {
  let loaded: ComponentType | undefined
  let pending: Promise<ComponentType> | undefined

  const preload = () =>
    (pending ??= load().then(
      (page) => (loaded = page),
      (error: unknown) => {
        // Let the next attempt try the download again.
        pending = undefined
        throw error
      },
    ))

  const Component = lazy(() => {
    if (loaded) {
      const page = loaded
      // A thenable that resolves synchronously; React reads it without suspending.
      return { then: (resolve: (module: PageModule) => void) => resolve({ default: page }) } as unknown as Promise<PageModule>
    }
    return preload().then((page) => ({ default: page }))
  })

  return { Component, preload }
}

const dashboard = lazyPage(() => import('./DashboardPage').then((m) => m.DashboardPage))
const employees = lazyPage(() => import('./EmployeesPage').then((m) => m.EmployeesPage))
const organisation = lazyPage(() => import('./OrganisationPage').then((m) => m.OrganisationPage))
const attendance = lazyPage(() => import('./AttendancePage').then((m) => m.AttendancePage))
const leave = lazyPage(() => import('./LeavePage').then((m) => m.LeavePage))
const payroll = lazyPage(() => import('./PayrollPage').then((m) => m.PayrollPage))
const recruitment = lazyPage(() => import('./RecruitmentPage').then((m) => m.RecruitmentPage))
const reports = lazyPage(() => import('./ReportsPage').then((m) => m.ReportsPage))
const policies = lazyPage(() => import('./PolicyDocumentsPage').then((m) => m.PolicyDocumentsPage))
const account = lazyPage(() => import('./AccountSettingsPage').then((m) => m.AccountSettingsPage))

export const DashboardPage = dashboard.Component
export const EmployeesPage = employees.Component
export const OrganisationPage = organisation.Component
export const AttendancePage = attendance.Component
export const LeavePage = leave.Component
export const PayrollPage = payroll.Component
export const RecruitmentPage = recruitment.Component
export const ReportsPage = reports.Component
export const PolicyDocumentsPage = policies.Component
export const AccountSettingsPage = account.Component

const pagesByPath: Record<string, ReturnType<typeof lazyPage>> = {
  '/': dashboard,
  '/employees': employees,
  '/organisation': organisation,
  '/attendance': attendance,
  '/leave': leave,
  '/payroll': payroll,
  '/recruitment': recruitment,
  '/reports': reports,
  '/policies': policies,
  '/account': account,
}

// Start downloading a page before it is opened (on hover or focus of its link).
export function preloadPage(path: string) {
  void pagesByPath[path]?.preload().catch(() => {})
}

// Download every page in the background once the browser is idle, so even a
// first visit opens straight away. Skipped when the user asked to save data.
export function preloadAllPages() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return () => {}

  const run = () => {
    for (const page of Object.values(pagesByPath)) void page.preload().catch(() => {})
  }
  if ('requestIdleCallback' in window) {
    const handle = window.requestIdleCallback(run, { timeout: 4000 })
    return () => window.cancelIdleCallback(handle)
  }
  const handle = setTimeout(run, 1500)
  return () => clearTimeout(handle)
}
