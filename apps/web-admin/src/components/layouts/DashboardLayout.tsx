import { useApolloClient } from '@apollo/client'
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { clearAdminSession, useAdminSession } from '@/lib/auth-session'
import { formatDate } from '@/lib/utils'

const primaryNavigation = [
  {
    name: 'Home',
    href: '/',
    icon: LayoutDashboard,
    description: 'Daily overview.',
  },
  {
    name: 'People Directory',
    href: '/directory',
    icon: Search,
    description: 'Search people and key employee details.',
  },
  {
    name: 'Leaves',
    href: '/leave',
    icon: Calendar,
    description: 'Review leave requests and policies.',
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: Briefcase,
    description: 'Track attendance activity and locations.',
  },
  {
    name: 'Payroll',
    href: '/payroll',
    icon: DollarSign,
    description: 'Run monthly payroll operations.',
  },
]

const secondaryNavigation = [
  {
    name: 'Employees',
    href: '/employees',
    icon: Users,
    description: 'Maintain employee records and access.',
  },
  {
    name: 'Recruitment',
    href: '/recruitment',
    icon: FileText,
    description: 'Live hiring records.',
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    description: 'Exports and monthly reporting.',
  },
  {
    name: 'Policies',
    href: '/policies',
    icon: BookOpen,
    description: 'Policy documents and publishing.',
  },
]

const navigation = [...primaryNavigation, ...secondaryNavigation]

export function DashboardLayout() {
  const apolloClient = useApolloClient()
  const location = useLocation()
  const navigate = useNavigate()
  const { account } = useAdminSession()

  const currentPage =
    navigation.find((item) =>
      item.href === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.href)
    ) ?? navigation[0]

  useEffect(() => {
    document.title = `${currentPage.name} - Rakss HR Admin`
  }, [currentPage.name])

  const handleLogout = async () => {
    clearAdminSession()
    await apolloClient.clearStore()
    navigate('/login')
  }

  const initials = account?.fullName
    ? account.fullName
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase()
    : 'RA'

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1500px] overflow-hidden rounded-[2rem] border border-border/70 bg-white/92 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="lg:grid lg:min-h-[calc(100vh-1.5rem)] lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="border-b border-border/70 bg-white lg:border-b-0 lg:border-r">
            <div className="space-y-6 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="app-kicker">Rakss HR</p>
                  <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
                    Admin workspace
                  </p>
                </div>
              </div>

              {account ? (
                <div className="rounded-[1.25rem] border border-border/70 bg-secondary/60 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{account.fullName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{account.email}</p>
                </div>
              ) : null}

              <div className="space-y-5">
                <div>
                  <p className="app-kicker px-2">Workspace</p>
                  <nav className="mt-2 space-y-1">
                    {primaryNavigation.map((item) => (
                      <NavItem key={item.href} item={item} />
                    ))}
                  </nav>
                </div>

                <div>
                  <p className="app-kicker px-2">Admin</p>
                  <nav className="mt-2 space-y-1">
                    {secondaryNavigation.map((item) => (
                      <NavItem key={item.href} item={item} />
                    ))}
                  </nav>
                </div>
              </div>

              <Button className="w-full justify-start" variant="outline" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
            </div>
          </aside>

          <div className="min-w-0 bg-[linear-gradient(180deg,rgba(245,248,251,0.72),rgba(248,250,252,0.92))]">
            <div className="border-b border-border/70 bg-white/80 px-4 py-4 backdrop-blur sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="app-kicker">{formatDate(new Date())}</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                    {currentPage.name}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {currentPage.description}
                  </p>
                </div>

                {account ? (
                  <div className="flex items-center gap-3 self-start rounded-full border border-border/70 bg-secondary/70 px-3 py-2 lg:self-auto">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {initials}
                    </div>
                    <div className="pr-1">
                      <p className="text-sm font-semibold text-foreground">{account.fullName}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {account.roles.slice(0, 2).map((role) => (
                          <StatusBadge key={role} tone="accent">
                            {role}
                          </StatusBadge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <main className="space-y-5 px-4 py-4 sm:px-6 sm:py-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavItem({
  item,
}: {
  item: {
    name: string
    href: string
    icon: typeof LayoutDashboard
  }
}) {
  return (
    <NavLink
      end={item.href === '/'}
      to={item.href}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-[1rem] px-3 py-3 text-sm font-medium transition-all',
          isActive
            ? 'bg-secondary text-foreground shadow-[inset_3px_0_0_0_hsl(var(--primary))]'
            : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={[
              'flex h-8 w-8 items-center justify-center rounded-xl',
              isActive ? 'bg-primary/12 text-primary' : 'bg-white text-muted-foreground',
            ].join(' ')}
          >
            <item.icon className="h-4 w-4" />
          </div>
          <span>{item.name}</span>
        </>
      )}
    </NavLink>
  )
}
