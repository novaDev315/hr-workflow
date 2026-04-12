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

const primaryNavigation = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "People Directory", href: "/directory", icon: Search },
  { name: "Leaves", href: "/leave", icon: Calendar },
  { name: "Attendance", href: "/attendance", icon: Briefcase },
  { name: "Payroll", href: "/payroll", icon: DollarSign },
];

const secondaryNavigation = [
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Recruitment", href: "/recruitment", icon: FileText },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Policies", href: "/policies", icon: BookOpen },
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
    <div className="min-h-screen px-2 py-2 sm:px-3 sm:py-3">
      <div className="app-shell mx-auto min-h-[calc(100vh-1rem)] max-w-[1440px] overflow-hidden">
        <div className="lg:grid lg:min-h-[calc(100vh-1rem)] lg:grid-cols-[228px_minmax(0,1fr)]">
          <aside className="app-shell-sidebar border-b border-border/70 lg:border-b-0 lg:border-r">
            <div className="space-y-5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <ShieldCheck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="app-kicker">Rakss HR</p>
                    <p className="mt-0.5 text-base font-semibold tracking-[-0.03em] text-foreground">
                      Admin workspace
                    </p>
                  </div>
                </div>

                <Button
                  aria-label={
                    mobileNavOpen ? "Close navigation" : "Open navigation"
                  }
                  className="lg:hidden"
                  onClick={() => setMobileNavOpen((current) => !current)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  {mobileNavOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div
                className={
                  mobileNavOpen
                    ? "space-y-5 lg:block"
                    : "hidden space-y-5 lg:block"
                }
              >
                <div className="space-y-4">
                  <div>
                    <p className="app-kicker px-3">Workspace</p>
                    <nav className="mt-2 space-y-1">
                      {primaryNavigation.map((item) => (
                        <NavItem key={item.href} item={item} />
                      ))}
                    </nav>
                  </div>

                  <div>
                    <p className="app-kicker px-3">Admin</p>
                    <nav className="mt-2 space-y-1">
                      {secondaryNavigation.map((item) => (
                        <NavItem key={item.href} item={item} />
                      ))}
                    </nav>
                  </div>
                </div>

                <Button
                  className="w-full justify-start px-3"
                  variant="ghost"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>
            </div>
          </aside>

          <div className="app-shell-main min-w-0">
            <div className="app-shell-header px-4 py-3.5 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="app-kicker">{formatDate(new Date())}</p>
                  <h1 className="app-section-title mt-1.5 text-[2.2rem]">
                    {currentPage.name}
                  </h1>
                </div>

                {account ? (
                  <div className="app-shell-account flex items-center gap-3 self-start px-3 py-2 sm:self-auto">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {initials}
                    </div>
                    <div className="pr-0.5">
                      <p className="text-sm font-semibold leading-none text-foreground">
                        {account.fullName}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {account.roles[0] ?? "Admin"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <main className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
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
          "flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-[rgba(255,255,255,0.8)] text-foreground shadow-[inset_3px_0_0_0_hsl(var(--primary)),0_10px_20px_rgba(78,50,23,0.04)]"
            : "text-muted-foreground hover:bg-[rgba(255,255,255,0.58)] hover:text-foreground",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={[
              "h-4 w-4 shrink-0",
              isActive ? "text-primary" : "text-muted-foreground",
            ].join(" ")}
          />
          <span>{item.name}</span>
        </>
      )}
    </NavLink>
  );
}
