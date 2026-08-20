import { FormEvent, lazy, ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  AlertDialog,
  Button,
  Card,
  Chip,
  Drawer,
  Input,
  Popover,
  Separator,
  Spinner,
  Tooltip
} from "@heroui/react";
import {
  CalendarCheck,
  Clock3,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Sun,
  UserRound,
  X,
  UsersRound
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";
import { api, type AuthUser, type DashboardResponse, type Role, type Tenant, type TenantFeature } from "./shared/api/client";
import { allowedViews, navigationFor, pathForView, viewForPath } from "./app/features";
import type { NavigationItem, ViewKey } from "./app/feature-types";
import { hasUnsavedChanges } from "./shared/hooks/useUnsavedChanges";
import {
  AUTH_EXPIRED_EVENT,
  clearSession,
  isTokenExpired,
  readSession,
  SESSION_KEY,
  tokenExpiresAt,
  writeSession,
  type Session
} from "./shared/auth/session";

const AttendancePage = lazy(() => import("./features/attendance").then((module) => ({ default: module.AttendancePage })));
const DashboardDetails = lazy(() => import("./features/dashboard").then((module) => ({ default: module.DashboardDetails })));
const PeoplePage = lazy(() => import("./features/people").then((module) => ({ default: module.PeoplePage })));
const ProfilePage = lazy(() => import("./features/profile").then((module) => ({ default: module.ProfilePage })));
const SystemsPage = lazy(() => import("./features/systems").then((module) => ({ default: module.SystemsPage })));
const TenantsPage = lazy(() => import("./features/tenants").then((module) => ({ default: module.TenantsPage })));
const MemberDashboard = lazy(() => import("./features/scheduling").then((module) => ({ default: module.MemberDashboard })));
const SchedulingPage = lazy(() => import("./features/scheduling").then((module) => ({ default: module.SchedulingPage })));

type ThemeMode = "light" | "dark";

function roleLabel(role: Role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "tenant_admin") return "Tenant Admin";
  if (role === "tenant_staff") return "Staff";
  return "Member";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="field-label">{children}</span>;
}

function numberValue(value: unknown) {
  return Number(value ?? 0).toLocaleString();
}

function attendanceCount(dashboard: DashboardResponse | null, status: string) {
  return dashboard?.todayAttendance?.find((item) => item.status === status)?.count ?? 0;
}

function formatChartDate(date: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

function AttendanceHistoryChart({ dashboard }: { dashboard: DashboardResponse | null }) {
  const history = dashboard?.attendanceHistory ?? [];
  const hasRecords = history.some((item) => item.total > 0);
  const chartData = history.map((item) => ({
    ...item,
    label: formatChartDate(item.date)
  }));

  return (
    <div className="attendance-chart-wrap">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 16, right: 10, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-present)" stopOpacity={0.42} />
              <stop offset="95%" stopColor="var(--chart-present)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="lateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-late)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chart-late)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 12, fontWeight: 700 }}
          />
          <RechartsTooltip
            cursor={{ stroke: "var(--blue)", strokeDasharray: "4 4" }}
            contentStyle={{
              background: "var(--panel-strong)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              boxShadow: "0 20px 50px rgba(26, 34, 55, 0.14)",
              color: "var(--text)"
            }}
            labelStyle={{ color: "var(--text)", fontWeight: 800 }}
          />
          <Area
            type="monotone"
            dataKey="present"
            name="Present"
            stroke="var(--chart-present)"
            strokeWidth={3}
            fill="url(#presentGradient)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--panel-strong)" }}
          />
          <Area
            type="monotone"
            dataKey="late"
            name="Late"
            stroke="var(--chart-late)"
            strokeWidth={2}
            fill="url(#lateGradient)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel-strong)" }}
          />
          <Area
            type="monotone"
            dataKey="absent"
            name="Absent"
            stroke="var(--chart-absent)"
            strokeWidth={2}
            fill="transparent"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--panel-strong)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {!hasRecords ? (
        <div className="chart-empty">
          <Chip variant="soft" color="accent">No attendance recorded in the last 7 days</Chip>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon, tone = "blue" }: { label: string; value: string; icon: ReactNode; tone?: "blue" | "green" | "violet" | "amber" }) {
  return (
    <Card className={`stat-card tone-${tone}`}>
      <Card.Content>
        <div className="stat-top">
          <span>{label}</span>
          <div className="stat-icon">{icon}</div>
        </div>
        <strong>{value}</strong>
      </Card.Content>
    </Card>
  );
}

function LoginPage({ onLogin, notice }: { onLogin: (session: Session) => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const submitLock = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError("");
    setIsLoading(true);

    try {
      const session = await api.login(email, password);
      writeSession(session);
      onLogin(session);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      submitLock.current = false;
      setIsLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <Card className="login-card">
        <Card.Header>
          <div className="brand-block">
            <div className="brand-mark"><CalendarCheck size={24} /></div>
            <div>
              <span>Personnel Management</span>
              <h1>Welcome back</h1>
              <p>Sign in with your email address or the ID provided by your organization.</p>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <form className="login-form" onSubmit={handleSubmit}>
            {notice ? <Chip color="warning" variant="soft">{notice}</Chip> : null}
            {error ? <Chip color="danger" variant="soft">{error}</Chip> : null}
            <label className="field-stack">
              <FieldLabel>Email or User ID</FieldLabel>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </label>
            <label className="field-stack">
              <FieldLabel>Password</FieldLabel>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <Button variant="primary" type="submit" isDisabled={isLoading}>
              {isLoading ? <Spinner size="sm" /> : <LogIn size={17} />}
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </main>
  );
}

function OnboardingPage({ session, onComplete }: { session: Session; onComplete: (session: Session) => void }) {
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [email, setEmail] = useState(session.user.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const submitLock = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError("");
    setIsSaving(true);
    try {
      const nextSession = await api.completeOnboarding(session.token, { displayName, email, password });
      writeSession(nextSession);
      onComplete(nextSession);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to complete setup");
    } finally {
      submitLock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <main className="login-shell">
      <Card className="login-card">
        <Card.Header>
          <div className="brand-block compact">
            <div className="brand-mark"><UserRound size={24} /></div>
            <div><span>Account setup</span><h1>Complete your profile</h1><p>Add the details you will use in your workspace.</p></div>
          </div>
        </Card.Header>
        <Card.Content>
          <form className="login-form" onSubmit={handleSubmit}>
            {error ? <Chip color="danger" variant="soft">{error}</Chip> : null}
            <label className="field-stack">
              <FieldLabel>Display name</FieldLabel>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </label>
            <label className="field-stack">
              <FieldLabel>Email</FieldLabel>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="field-stack">
              <FieldLabel>New password</FieldLabel>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
            </label>
            <Button variant="primary" type="submit" isDisabled={isSaving}>
              {isSaving ? <Spinner size="sm" /> : <LogIn size={17} />}
              {isSaving ? "Saving profile..." : "Enter workspace"}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </main>
  );
}

function Sidebar({
  collapsed,
  features,
  role,
  view,
  onNavigate,
  onToggle,
  mobile = false
}: {
  collapsed: boolean;
  features: TenantFeature[];
  role: Role;
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onToggle: () => void;
  mobile?: boolean;
}) {
  const items = navigationFor({ role, systems: features });
  const activeGroup = items.find((item) => item.children?.some((child) => child.view === view))?.label;
  const [openGroups, setOpenGroups] = useState(() => new Set(activeGroup ? [activeGroup] : []));

  useEffect(() => {
    if (!activeGroup) return;
    setOpenGroups((current) => new Set(current).add(activeGroup));
  }, [activeGroup]);

  function navButton(item: NavigationItem) {
    if (!item.view) return null;
    const button = <Button key={item.view} aria-current={view === item.view ? "page" : undefined} className={view === item.view ? "active" : ""} variant="ghost" isIconOnly={collapsed} onPress={() => onNavigate(item.view!)}>{item.icon}{!collapsed ? <span>{item.label}</span> : null}</Button>;
    return collapsed ? <Tooltip key={item.view}><Tooltip.Trigger>{button}</Tooltip.Trigger><Tooltip.Content placement="right">{item.label}</Tooltip.Content></Tooltip> : button;
  }

  function navigationItem(item: NavigationItem) {
    if (!item.children?.length) return navButton(item);
    if (collapsed) return item.children.map(navButton);
    const open = openGroups.has(item.label);
    return <div className="sidebar-group" key={item.label}>
      <Button className={item.children.some((child) => child.view === view) ? "active group-active" : ""} variant="ghost" onPress={() => setOpenGroups((current) => {
        const next = new Set(current);
        if (next.has(item.label)) next.delete(item.label); else next.add(item.label);
        return next;
      })}>{item.icon}<span>{item.label}</span><ChevronDown className={open ? "group-chevron open" : "group-chevron"} size={16} /></Button>
      {open ? <div className="sidebar-subnav">{item.children.map(navButton)}</div> : null}
    </div>;
  }

  return (
    <aside className={`sidebar ${mobile ? "mobile-sidebar" : "desktop-sidebar"} ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark small"><CalendarCheck size={20} /></div>
        {!collapsed ? <strong>Personnel</strong> : null}
      </div>
      <div className="sidebar-nav">
        {items.map(navigationItem)}
      </div>
      <Button variant="secondary" isIconOnly={collapsed && !mobile} onPress={onToggle}>
        {mobile ? <X size={18} /> : collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed ? <span>{mobile ? "Close navigation" : "Collapse"}</span> : null}
      </Button>
    </aside>
  );
}

function Topbar({
  session,
  tenant,
  theme,
  onLogout,
  onThemeChange,
  onOpenNavigation
}: {
  session: Session;
  tenant: Tenant | null;
  theme: ThemeMode;
  onLogout: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onOpenNavigation: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const timezone = session.user.timezone || "Asia/Colombo";
  const localDate = new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: "short", year: "numeric", month: "short", day: "numeric" }).format(now);
  const localTime = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now);
  const timezoneLabel = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: "short" }).formatToParts(now).find((part) => part.type === "timeZoneName")?.value ?? timezone;

  return (
    <header className="topbar">
      <Button className="mobile-menu-button" isIconOnly variant="ghost" aria-label="Open navigation" onPress={onOpenNavigation}><Menu size={20} /></Button>
      <div className="workspace-context">
        <span>{tenant?.name ?? "Personnel Management"}</span>
        <h1>{roleLabel(session.user.role)} workspace</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-clock" title={timezone}><Clock3 size={17} /><div><strong>{localTime}</strong><span>{localDate} | {timezoneLabel}</span></div></div>
        <Popover>
          <Popover.Trigger>
            <Button variant="ghost">
              <Avatar size="sm"><Avatar.Fallback>{initials(session.user.displayName)}</Avatar.Fallback></Avatar>
              <span>{session.user.displayName}</span>
              <ChevronDown size={16} />
            </Button>
          </Popover.Trigger>
          <Popover.Content>
            <Popover.Dialog className="profile-popover">
              <strong>{session.user.displayName}</strong>
              <span>{session.user.email ?? session.user.userIdentifier}</span>
              <Separator />
              <Button variant="ghost" onPress={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                {theme === "dark" ? "Use light theme" : "Use dark theme"}
              </Button>
              <Button variant="danger" onPress={onLogout}>
                <LogOut size={17} />
                Sign out
              </Button>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </header>
  );
}

function OperationalDashboard({ dashboard, role, token, tenant, user, schedulingEnabled, onNavigate }: { dashboard: DashboardResponse | null; role: Role; token: string; tenant: Tenant | null; user: AuthUser; schedulingEnabled: boolean; onNavigate: (view: ViewKey) => void }) {
  if (role === "tenant_member") return <MemberDashboard token={token} tenant={tenant} displayName={user.displayName} timezone={user.timezone} schedulingEnabled={schedulingEnabled} onNavigate={() => onNavigate("my-schedule")} />;
  const total = role === "super_admin" ? dashboard?.clients?.totalClients : dashboard?.users?.totalUsers ?? dashboard?.people?.totalPeople;
  const active = role === "super_admin" ? dashboard?.clients?.activeClients : dashboard?.people?.activePeople;
  const present = attendanceCount(dashboard, "present");
  const absent = attendanceCount(dashboard, "absent");

  return (
    <div className="main-column">
      <div className="dashboard-overview">
        <Card className="hero-panel chart-panel">
          <Card.Header>
            <div>
              <span>Last 7 days</span>
              <h2>{role === "super_admin" ? "System attendance history" : "Attendance history"}</h2>
            </div>
            <Chip variant="soft" color="accent">Live</Chip>
          </Card.Header>
          <Card.Content>
            <AttendanceHistoryChart dashboard={dashboard} />
          </Card.Content>
        </Card>
        <div className="metric-row">
          <StatCard label={role === "super_admin" ? "Total tenants" : "Total users"} value={numberValue(total)} icon={<UsersRound size={18} />} />
          <StatCard label="Active" value={numberValue(active)} icon={<ShieldCheck size={18} />} tone="green" />
          <StatCard label={role === "super_admin" ? "All users" : "Present today"} value={numberValue(role === "super_admin" ? dashboard?.users?.totalUsers : present)} icon={<CalendarCheck size={18} />} tone="violet" />
          {role === "super_admin" ? <StatCard label="Tenant admins" value={numberValue(dashboard?.users?.tenantAdmins)} icon={<UserRound size={18} />} tone="amber" /> : <StatCard label="Absent today" value={numberValue(absent)} icon={<CalendarCheck size={18} />} tone="amber" />}
        </div>
      </div>
        <DashboardDetails token={token} role={role} tenant={tenant} dashboard={dashboard} onNavigate={(next) => onNavigate(next as ViewKey)} />
    </div>
  );
}

function Workspace({ session, onLogout, onSession }: { session: Session; onLogout: () => void; onSession: (session: Session) => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => window.matchMedia("(max-width: 760px)").matches);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const view = viewForPath(location.pathname);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [features, setFeatures] = useState<TenantFeature[]>([]);
  const [tenantContextReady, setTenantContextReady] = useState(session.user.role === "super_admin");
  const [reloadKey, setReloadKey] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem("personnel-management-theme") === "dark" ? "dark" : "light"));
  const [error, setError] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requestAction = useCallback((action: () => void) => {
    if (!hasUnsavedChanges()) { action(); return; }
    pendingAction.current = action;
    setDiscardOpen(true);
  }, []);
  const navigateToView = useCallback((next: ViewKey) => requestAction(() => { navigate(pathForView(next)); setMobileNavigationOpen(false); }), [navigate, requestAction]);

  useEffect(() => {
    if (location.pathname === "/") navigate("/dashboard", { replace: true });
  }, [location.pathname, navigate]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("personnel-management-theme", theme);
  }, [theme]);

  useEffect(() => {
    api.me(session.token).then(({ user }) => {
      const next = { token: session.token, user };
      writeSession(next);
      onSession(next);
    }).catch(() => undefined);
  }, [onSession, session.token]);

  useEffect(() => {
    if (session.user.role === "tenant_member") { setDashboard(null); return; }
    api.dashboard(session.token).then(setDashboard).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard"));
  }, [reloadKey, session.token, session.user.role]);

  useEffect(() => {
    if (session.user.role === "super_admin") return;
    Promise.all([api.currentTenant(session.token), api.currentTenantFeatures(session.token)])
      .then(([tenantData, featureData]) => {
        setTenant(tenantData.tenant);
        setFeatures(featureData.features);
        setTenantContextReady(true);
      })
      .catch(() => {
        setTenant(null);
        setFeatures([]);
        setTenantContextReady(true);
      });
  }, [session.token, session.user.role]);

  useEffect(() => {
    if (!tenantContextReady) return;
    const allowed = allowedViews({ role: session.user.role, systems: features });
    if (!allowed.has(view)) navigate("/dashboard", { replace: true });
  }, [features, navigate, session.user.role, tenantContextReady, view]);

  const page = useMemo(() => {
    const changed = () => setReloadKey((value) => value + 1);
    if (view === "dashboard") return session.user.role === "tenant_member" && !tenant ? <Card className="state-card"><Card.Content><Spinner /><span>Loading your workspace</span></Card.Content></Card> : <OperationalDashboard dashboard={dashboard} role={session.user.role} token={session.token} tenant={tenant} user={session.user} schedulingEnabled={features.some((feature) => feature.code === "scheduling" && Boolean(feature.enabled))} onNavigate={navigateToView} />;
    if (view === "attendance" && tenant) return <AttendancePage token={session.token} tenant={tenant} features={features} onChanged={changed} />;
    if (view === "tenants" && session.user.role === "super_admin") return <TenantsPage token={session.token} onChanged={changed} />;
    if (view === "people" && tenant) return <PeoplePage token={session.token} tenant={tenant} role={session.user.role} onChanged={changed} />;
    if (view === "systems" && session.user.role === "super_admin") return <SystemsPage token={session.token} />;
    if (tenant && view === "schedule-calendar") return <SchedulingPage token={session.token} tenant={tenant} role={session.user.role} timezone={session.user.timezone} section="calendar" />;
    if (tenant && view === "schedule-add") return <SchedulingPage token={session.token} tenant={tenant} role={session.user.role} timezone={session.user.timezone} section="add" />;
    if (tenant && view === "schedule-regattas") return <SchedulingPage token={session.token} tenant={tenant} role={session.user.role} timezone={session.user.timezone} section="regattas" />;
    if (tenant && view === "schedule-setup") return <SchedulingPage token={session.token} tenant={tenant} role={session.user.role} timezone={session.user.timezone} section="setup" />;
    if (tenant && view === "my-schedule") return <SchedulingPage token={session.token} tenant={tenant} role={session.user.role} timezone={session.user.timezone} section="my" />;
    return <ProfilePage session={session} tenant={tenant} onSession={(next) => { writeSession(next); onSession(next); }} />;
  }, [dashboard, features, navigateToView, onSession, session, tenant, view]);

  return (
    <main className="app-shell">
      <Sidebar collapsed={collapsed} features={features} role={session.user.role} view={view} onNavigate={navigateToView} onToggle={() => setCollapsed((current) => !current)} />
      <Drawer isOpen={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <Drawer.Backdrop isDismissable>
          <Drawer.Content placement="left" className="mobile-navigation-drawer">
            <Drawer.Dialog>
              <Drawer.Header><Drawer.Heading>Navigation</Drawer.Heading><Drawer.CloseTrigger /></Drawer.Header>
              <Drawer.Body><Sidebar mobile collapsed={false} features={features} role={session.user.role} view={view} onNavigate={navigateToView} onToggle={() => setMobileNavigationOpen(false)} /></Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      <section className="workspace">
        <Topbar session={session} tenant={tenant} theme={theme} onThemeChange={setTheme} onLogout={() => requestAction(onLogout)} onOpenNavigation={() => setMobileNavigationOpen(true)} />
        <div className="workspace-content">
          {error ? <Chip color="danger" variant="soft">{error}</Chip> : null}
          <Suspense fallback={<Card className="state-card"><Card.Content><Spinner /><span>Loading workspace</span></Card.Content></Card>}>{page}</Suspense>
        </div>
      </section>
      <AlertDialog isOpen={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container placement="center">
            <AlertDialog.Dialog>
              {({ close }: { close: () => void }) => <><AlertDialog.Header><AlertDialog.Heading>Discard unsaved changes?</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body><p>You have changes that have not been saved. Continuing will discard them.</p></AlertDialog.Body><AlertDialog.Footer><Button variant="ghost" onPress={close}>Keep editing</Button><Button variant="danger" onPress={() => { const action = pendingAction.current; pendingAction.current = null; close(); action?.(); }}>Discard and continue</Button></AlertDialog.Footer></>}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [authNotice, setAuthNotice] = useState("");

  const handleLogout = useCallback(() => {
    clearSession();
    setAuthNotice("");
    setSession(null);
  }, []);

  const handleExpiredSession = useCallback(() => {
    clearSession();
    setAuthNotice("Your session expired. Sign in again to continue.");
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;

    const expiresAt = tokenExpiresAt(session.token);
    if (expiresAt === null || expiresAt <= Date.now()) {
      handleExpiredSession();
      return;
    }

    let timeout: number;
    const scheduleExpiryCheck = () => {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) {
        handleExpiredSession();
        return;
      }
      timeout = window.setTimeout(scheduleExpiryCheck, Math.min(remaining, 2_147_483_647));
    };
    scheduleExpiryCheck();
    const verifyActiveSession = () => {
      if (document.visibilityState === "visible" && isTokenExpired(session.token)) handleExpiredSession();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY && event.newValue === null) {
        setAuthNotice("You were signed out in another tab.");
        setSession(null);
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", verifyActiveSession);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", verifyActiveSession);
    };
  }, [handleExpiredSession, session]);

  if (!session) return <LoginPage notice={authNotice} onLogin={(next) => { setAuthNotice(""); setSession(next); }} />;
  if (session.user.requiresOnboarding) return <OnboardingPage session={session} onComplete={setSession} />;

  return <Workspace session={session} onLogout={handleLogout} onSession={setSession} />;
}
