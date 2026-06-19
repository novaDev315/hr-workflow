import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogIn,
  Search,
  Users,
} from 'lucide-react'

export type DemoPageId =
  | 'login'
  | 'dashboard'
  | 'employees'
  | 'directory'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'recruitment'
  | 'reports'
  | 'policies'

export type DemoPageMeta = {
  id: DemoPageId
  title: string
  shortTitle: string
  icon: LucideIcon
  utility?: boolean
}

export type DemoAppMeta = {
  id: string
  title: string
  summary: string
  tagline: string
  spectrum: 'grounded' | 'concept'
}

export type DemoAppModule = {
  meta: DemoAppMeta
  defaultPage?: DemoPageId
  renderPreview: () => ReactNode
  renderPage: (pageId: DemoPageId) => ReactNode
}

export const demoPages: DemoPageMeta[] = [
  { id: 'login', title: 'Login', shortTitle: 'Login', icon: LogIn, utility: true },
  { id: 'dashboard', title: 'Dashboard', shortTitle: 'Home', icon: LayoutDashboard },
  { id: 'employees', title: 'Employees', shortTitle: 'Employees', icon: Users },
  { id: 'directory', title: 'Directory', shortTitle: 'Directory', icon: Search },
  { id: 'attendance', title: 'Attendance', shortTitle: 'Attendance', icon: Briefcase },
  { id: 'leave', title: 'Leave', shortTitle: 'Leave', icon: CalendarDays },
  { id: 'payroll', title: 'Payroll', shortTitle: 'Payroll', icon: DollarSign },
  { id: 'recruitment', title: 'Recruitment', shortTitle: 'Hiring', icon: Building2 },
  { id: 'reports', title: 'Reports', shortTitle: 'Reports', icon: BarChart3 },
  { id: 'policies', title: 'Policies', shortTitle: 'Policies', icon: FileText },
]

export const workspacePages = demoPages.filter((page) => !page.utility)

export function getDemoPage(pageId: DemoPageId) {
  return demoPages.find((page) => page.id === pageId) ?? demoPages[0]
}

export function demoHref(appId: string, pageId: DemoPageId = 'dashboard') {
  return `/demos/${appId}/${pageId}`
}
