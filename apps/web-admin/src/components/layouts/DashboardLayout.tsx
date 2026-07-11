import { useApolloClient } from "@apollo/client";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Calendar,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { clearAdminSession, useAdminSession } from "@/lib/auth-session";
import { formatDate } from "@/lib/utils";
import {
  WorkspaceSwitcher,
  type WorkspaceNavigationItem,
} from "./workspace-switcher";

const primaryNavigation: WorkspaceNavigationItem[] = [
  {
    name: "Home",
    description: "Today’s priorities and activity",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "People Directory",
    description: "Find people and contact details",
    href: "/directory",
    icon: Search,
  },
  {
    name: "Leaves",
    description: "Requests, approvals, and balances",
    href: "/leave",
    icon: Calendar,
  },
  {
    name: "Attendance",
    description: "Schedules, assignments, and time",
    href: "/attendance",
    icon: Briefcase,
  },
  {
    name: "Payroll",
    description: "Periods, runs, and payslips",
    href: "/payroll",
    icon: DollarSign,
  },
];

const secondaryNavigation: WorkspaceNavigationItem[] = [
  {
    name: "Employees",
    description: "Records, access, and organization",
    href: "/employees",
    icon: Users,
  },
  {
    name: "Recruitment",
    description: "Requisitions and candidates",
    href: "/recruitment",
    icon: FileText,
  },
  {
    name: "Reports",
    description: "People and payroll reporting",
    href: "/reports",
    icon: BarChart3,
  },
  {
    name: "Policies",
    description: "Publish and manage documents",
    href: "/policies",
    icon: BookOpen,
  },
];

const navigation = [...primaryNavigation, ...secondaryNavigation];

export function DashboardLayout() {
  const apolloClient = useApolloClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { account } = useAdminSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentPage =
    navigation.find((item) =>
      item.href === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.href),
    ) ?? navigation[0];

  useEffect(() => {
    document.title = `${currentPage.name} - Rakss HR Admin`;
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
    clearAdminSession();
    await apolloClient.clearStore();
    navigate("/login");
  };

  const initials = account?.fullName
    ? account.fullName
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0] ?? "")
        .join("")
        .toUpperCase()
    : "RA";

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-primary">
                Rakss HR
              </p>
              <p className="mt-0.5 text-sm font-semibold tracking-[-0.02em] text-foreground">
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
          <NavigationGroup items={primaryNavigation} label="Workspace" />
          <NavigationGroup
            className="mt-6"
            items={secondaryNavigation}
            label="Manage"
          />
        </div>

        <div className="border-t border-border/70 p-3">
          {account ? (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {account.fullName}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {account.roles[0] ?? "Admin"}
                </p>
              </div>
              <Button
                aria-label="Log out"
                onClick={handleLogout}
                size="icon"
                variant="ghost"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
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
              {formatDate(new Date())}
            </p>
          </div>

          <WorkspaceSwitcher items={navigation} />
          {account ? (
            <div
              aria-label={`Signed in as ${account.fullName}`}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:flex lg:hidden"
              title={account.fullName}
            >
              {initials}
            </div>
          ) : null}
        </header>

        <main className="mx-auto w-full max-w-[1320px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavigationGroup({
  className = "",
  items,
  label,
}: {
  className?: string;
  items: WorkspaceNavigationItem[];
  label: string;
}) {
  return (
    <div className={className}>
      <p className="app-kicker px-3">{label}</p>
      <nav className="mt-2 space-y-1">
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
          "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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
