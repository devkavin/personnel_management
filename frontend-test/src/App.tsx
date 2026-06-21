import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Input,
  Popover,
  Separator,
  Spinner,
  Tooltip
} from "@heroui/react";
import {
  CalendarCheck,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  UserPlus,
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
import { api, type AuthUser, type DashboardResponse, type Role, type Tenant, type TenantFeature } from "./api";
import { AttendancePage, DashboardDetails, PeoplePage, ProfilePage, SystemsPage, TenantsPage } from "./pages";

const SESSION_KEY = "personnel_management_frontend_test_session";
type ThemeMode = "light" | "dark";
type ViewKey = "dashboard" | "attendance" | "people" | "systems" | "profile";

interface Session {
  token: string;
  user: AuthUser;
}

function readSession() {
  const value = localStorage.getItem(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

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

function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [clientSlug, setClientSlug] = useState("");
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
      if (mode === "register") {
        await api.register({ clientSlug, displayName, email, password });
        setMode("login");
        setError("Registration complete. You can now sign in.");
        return;
      }
      const session = await api.login(email, password);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
              <span>Personnel OS</span>
              <h1>{mode === "login" ? "Sign in to your workspace." : "Create your member account."}</h1>
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          <form className="login-form" onSubmit={handleSubmit}>
            {error ? <Chip color="danger" variant="soft">{error}</Chip> : null}
            {mode === "register" ? <>
              <label className="field-stack"><FieldLabel>Tenant slug</FieldLabel><Input value={clientSlug} onChange={(event) => setClientSlug(event.target.value)} required /></label>
              <label className="field-stack"><FieldLabel>Display name</FieldLabel><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
            </> : null}
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
              {isLoading ? <Spinner size="sm" /> : mode === "login" ? <LogIn size={17} /> : <UserPlus size={17} />}
              {isLoading ? (mode === "login" ? "Signing in..." : "Registering...") : mode === "login" ? "Sign in" : "Register"}
            </Button>
            <Button variant="ghost" type="button" onPress={() => { setError(""); setMode((value) => value === "login" ? "register" : "login"); }}>
              {mode === "login" ? "Create member account" : "Back to sign in"}
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
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
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
          <h1>Complete profile</h1>
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

function navItems(role: Role, features: TenantFeature[]) {
  const attendanceEnabled = features.some((feature) => feature.code.startsWith("attendance") && Boolean(feature.enabled));
  return [
    { key: "dashboard" as const, label: "Dashboard", icon: <LayoutDashboard size={19} /> },
    ...(attendanceEnabled && (role === "tenant_staff" || role === "tenant_admin")
      ? [{ key: "attendance" as const, label: "Attendance", icon: <CalendarCheck size={19} /> }]
      : []),
    ...(role === "tenant_admin" || role === "tenant_staff" || role === "super_admin"
      ? [{ key: "people" as const, label: role === "super_admin" ? "Tenants" : "People", icon: <UsersRound size={19} /> }]
      : []),
    ...(role === "super_admin" ? [{ key: "systems" as const, label: "Systems", icon: <Settings size={19} /> }] : []),
    { key: "profile" as const, label: "Profile", icon: <UserRound size={19} /> }
  ];
}

function Sidebar({
  collapsed,
  features,
  role,
  view,
  onNavigate,
  onToggle
}: {
  collapsed: boolean;
  features: TenantFeature[];
  role: Role;
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  onToggle: () => void;
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark small"><CalendarCheck size={20} /></div>
        {!collapsed ? <strong>Personnel</strong> : null}
      </div>
      <div className="sidebar-nav">
        {navItems(role, features).map((item) => {
          const button = (
            <Button
              key={item.key}
              className={view === item.key ? "active" : ""}
              variant="ghost"
              isIconOnly={collapsed}
              onPress={() => onNavigate(item.key)}
            >
              {item.icon}
              {!collapsed ? <span>{item.label}</span> : null}
            </Button>
          );
          return collapsed ? (
            <Tooltip key={item.key}>
              <Tooltip.Trigger>{button}</Tooltip.Trigger>
              <Tooltip.Content placement="right">{item.label}</Tooltip.Content>
            </Tooltip>
          ) : button;
        })}
      </div>
      <Button variant="secondary" isIconOnly={collapsed} onPress={onToggle}>
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        {!collapsed ? <span>Collapse</span> : null}
      </Button>
    </aside>
  );
}

function Topbar({
  session,
  tenant,
  theme,
  onLogout,
  onThemeChange
}: {
  session: Session;
  tenant: Tenant | null;
  theme: ThemeMode;
  onLogout: () => void;
  onThemeChange: (theme: ThemeMode) => void;
}) {
  return (
    <header className="topbar">
      <div>
        <span>{tenant?.name ?? roleLabel(session.user.role)}</span>
        <h1>{roleLabel(session.user.role)} workspace</h1>
      </div>
      <div className="topbar-actions">
        <Button variant="outline" onPress={() => onThemeChange(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
          {theme === "dark" ? "Dark" : "Light"}
        </Button>
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

function OperationalDashboard({ dashboard, role, token, tenant, onNavigate }: { dashboard: DashboardResponse | null; role: Role; token: string; tenant: Tenant | null; onNavigate: (view: ViewKey) => void }) {
  const total = role === "super_admin" ? dashboard?.clients?.totalClients : dashboard?.users?.totalUsers ?? dashboard?.people?.totalPeople;
  const active = role === "super_admin" ? dashboard?.clients?.activeClients : dashboard?.people?.activePeople;
  const present = attendanceCount(dashboard, "present");
  const absent = attendanceCount(dashboard, "absent");

  return (
    <div className="main-column">
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
        <DashboardDetails token={token} role={role} tenant={tenant} dashboard={dashboard} onNavigate={(next) => onNavigate(next as ViewKey)} />
    </div>
  );
}

function Workspace({ session, onLogout, onSession }: { session: Session; onLogout: () => void; onSession: (session: Session) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [features, setFeatures] = useState<TenantFeature[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem("frontend-test-theme") === "dark" ? "dark" : "light"));
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("frontend-test-theme", theme);
  }, [theme]);

  useEffect(() => {
    api.me(session.token).then(({ user }) => {
      const next = { token: session.token, user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      onSession(next);
    }).catch(() => undefined);
  }, [onSession, session.token]);

  useEffect(() => {
    api.dashboard(session.token).then(setDashboard).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard"));
  }, [reloadKey, session.token]);

  useEffect(() => {
    if (session.user.role === "super_admin") return;
    Promise.all([api.currentTenant(session.token), api.currentTenantFeatures(session.token)])
      .then(([tenantData, featureData]) => {
        setTenant(tenantData.tenant);
        setFeatures(featureData.features);
      })
      .catch(() => {
        setTenant(null);
        setFeatures([]);
      });
  }, [session.token, session.user.role]);

  const page = useMemo(() => {
    const changed = () => setReloadKey((value) => value + 1);
    if (view === "dashboard") return <OperationalDashboard dashboard={dashboard} role={session.user.role} token={session.token} tenant={tenant} onNavigate={setView} />;
    if (view === "attendance" && tenant) return <AttendancePage token={session.token} tenant={tenant} features={features} onChanged={changed} />;
    if (view === "people") return session.user.role === "super_admin" ? <TenantsPage token={session.token} onChanged={changed} /> : tenant ? <PeoplePage token={session.token} tenant={tenant} role={session.user.role} onChanged={changed} /> : null;
    if (view === "systems" && session.user.role === "super_admin") return <SystemsPage token={session.token} />;
    return <ProfilePage session={session} tenant={tenant} onSession={(next) => { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); onSession(next); }} />;
  }, [dashboard, features, onSession, session, tenant, view]);

  return (
    <main className="app-shell">
      <Sidebar collapsed={collapsed} features={features} role={session.user.role} view={view} onNavigate={setView} onToggle={() => setCollapsed((current) => !current)} />
      <section className="workspace">
        <Topbar session={session} tenant={tenant} theme={theme} onThemeChange={setTheme} onLogout={onLogout} />
        {error ? <Chip color="danger" variant="soft">{error}</Chip> : null}
        {page}
      </section>
    </main>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (!session) return <LoginPage onLogin={setSession} />;
  if (session.user.requiresOnboarding) return <OnboardingPage session={session} onComplete={setSession} />;

  return <Workspace session={session} onLogout={handleLogout} onSession={setSession} />;
}
