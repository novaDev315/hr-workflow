import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  Clock3,
  LayoutDashboard,
  Menu,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/toaster";
import { clearAdminSession, useAdminSession } from "@/lib/auth-session";
import { formatDay } from "@/lib/format";
import { AccountMenu } from "./account-menu";
import { ChangePasswordSheet } from "./change-password-sheet";
import {
  WorkspaceSwitcher,
  type WorkspaceNavigationItem,
} from "./workspace-switcher";

const primaryNavigation: WorkspaceNavigationItem[] = [
  {
    name: "Home",
    description: "Today's priorities and recent activity",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "People",
    description: "Employees, pay, work sites and sign-in",
    href: "/employees",
    icon: Users,
    keywords: "employees directory staff team hire",
  },
  {
    name: "Leave",
    description: "Requests, approvals and balances",
    href: "/leave",
    icon: Calendar,
    keywords: "time off vacation holiday",
  },
  {
    name: "Attendance",
    description: "Clock-ins and time at each site",
    href: "/attendance",
    icon: Clock3,
    keywords: "clock in out time",
  },
  {
    name: "Payroll",
    description: "Pay periods, runs and payslips",
    href: "/payroll",
    icon: Wallet,
    keywords: "salary payslip",
  },
  {
    name: "Recruitment",
    description: "Openings and the candidate pipeline",
    href: "/recruitment",
    icon: Briefcase,
    keywords: "hiring candidates jobs requisitions",
  },
  {
    name: "Reports",
    description: "People and payroll reporting",
    href: "/reports",
    icon: BarChart3,
  },
];

const settingsNavigation: WorkspaceNavigationItem[] = [
  {
    name: "Organisation",
    description: "Company details, departments, designations and work sites",
    href: "/organisation",
    icon: Building2,
    keywords: "company settings departments designations locations sites currency timezone",
  },
  {
    name: "Policies",
    description: "Publish and manage policy documents",
    href: "/policies",
    icon: BookOpen,
    keywords: "documents handbook",
  },
];

const navigation = [...primaryNavigation, ...settingsNavigation];

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useAdminSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const currentPage =
    navigation.find((item) =>
      item.href === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.href),
    ) ?? navigation[0];

  useEffect(() => {
    document.title = `${currentPage.name} · HRFlow Pro`;
  }, [currentPage.name]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const handleLogout = async () => {
    await clearAdminSession();
    navigate("/login");
  };

  return (
    <div className="app-layout min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      {mobileNavOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        aria-label="Main navigation"
        className={[
          "app-shell-sidebar fixed inset-y-0 left-0 z-50 flex w-[min(86vw,300px)] flex-col border-r border-border/80 transition-transform duration-200 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-auto lg:translate-x-0",
          mobileNavOpen
            ? "visible translate-x-0"
            : "invisible -translate-x-full lg:visible",
        ].join(" ")}
      >
        <div className="flex h-[72px] items-center justify-between gap-3 border-b border-border/70 px-5">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="app-editorial text-[1.15rem] leading-none text-foreground">
                HRFlow Pro
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                People operations
              </p>
            </div>
          </div>
          <Button
            aria-label="Close navigation"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <NavigationGroup items={primaryNavigation} label="Main navigation" hideLabel />
          <NavigationGroup
            className="mt-6"
            items={settingsNavigation}
            label="Settings"
          />
        </div>

        <div className="border-t border-border/70 p-3">
          {account ? (
            <AccountMenu
              account={account}
              onChangePassword={() => setPasswordOpen(true)}
              onSignOut={handleLogout}
              variant="sidebar"
            />
          ) : null}
        </div>
      </aside>

      <div className="app-shell-main min-w-0">
        <header className="app-shell-header sticky top-0 z-30 flex h-[72px] items-center gap-3 px-4 sm:px-6">
          <Button
            aria-label="Open navigation"
            className="shrink-0 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            size="icon"
            type="button"
            variant="outline"
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {currentPage.name}
            </p>
            <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
              {formatDay(new Date())}
            </p>
          </div>

          <WorkspaceSwitcher items={navigation} />
          {account ? (
            <AccountMenu
              account={account}
              onChangePassword={() => setPasswordOpen(true)}
              onSignOut={handleLogout}
              variant="avatar"
            />
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[1320px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <Outlet />
        </main>
      </div>
      <ChangePasswordSheet onOpenChange={setPasswordOpen} open={passwordOpen} />
      <Toaster />
    </div>
  );
}

function NavigationGroup({
  className = "",
  items,
  label,
  hideLabel = false,
}: {
  className?: string;
  items: WorkspaceNavigationItem[];
  label: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={className}>
      {hideLabel ? null : (
        <p className="px-3 text-xs font-semibold text-muted-foreground">{label}</p>
      )}
      <nav aria-label={label} className={hideLabel ? "space-y-0.5" : "mt-2 space-y-0.5"}>
        {items.map((item) => (
          <NavItem item={item} key={item.href} />
        ))}
      </nav>
    </div>
  );
}

function NavItem({
  item,
}: {
  item: {
    name: string;
    href: string;
    icon: typeof LayoutDashboard;
  };
}) {
  return (
    <NavLink
      end={item.href === "/"}
      to={item.href}
      className={({ isActive }) =>
        [
          "group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive
            ? "bg-primary/10 font-semibold text-primary"
            : "text-muted-foreground hover:bg-card/80 hover:text-foreground",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={[
              "h-4 w-4 shrink-0",
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground",
            ].join(" ")}
          />
          <span>{item.name}</span>
        </>
      )}
    </NavLink>
  );
}
