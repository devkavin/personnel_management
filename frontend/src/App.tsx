import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound
} from "lucide-react";
import { api, type AttendanceRecord, type AttendanceStatus, type AuthUser, type DashboardResponse, type Person, type Tenant } from "./lib/api";

const SESSION_KEY = "personnel_management_session";

interface Session {
  token: string;
  user: AuthUser;
}

type View = "dashboard" | "tenants" | "users" | "attendance" | "profile";

function readSession(): Session | null {
  const value = localStorage.getItem(SESSION_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as Session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function roleLabel(role: AuthUser["role"]) {
  if (role === "super_admin") return "Super admin";
  if (role === "client_admin") return "Tenant admin";
  return "Member";
}

function numberValue(value: unknown) {
  return Number(value ?? 0).toLocaleString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await api.login(email, password);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onLogin(session);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-brand" aria-label="Personnel Management">
        <div className="brand-mark">
          <UsersRound size={28} aria-hidden="true" />
        </div>
        <p className="eyebrow">Personnel Management</p>
        <h1>Operations for every team, class, and workplace.</h1>
        <div className="brand-metrics" aria-label="Platform capabilities">
          <span><ShieldCheck size={18} /> Tenant aware</span>
          <span><BadgeCheck size={18} /> Role based</span>
          <span><CalendarDays size={18} /> Attendance ready</span>
        </div>
      </section>

      <section className="login-panel" aria-label="Sign in">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in</h2>
        </div>

        {error ? <Alert message={error} /> : null}

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Email
            <input type="email" value={email} autoComplete="email" onChange={(event) => setEmail(event.target.value)} required />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}

function Alert({ message, tone = "error" }: { message: string; tone?: "error" | "success" }) {
  return (
    <div className={`alert ${tone}`} role="alert">
      <CircleAlert size={18} aria-hidden="true" />
      {message}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "green" | "gold" | "blue" | "ink";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function SystemDashboard({ dashboard, onOpenTenants }: { dashboard: DashboardResponse; onOpenTenants: () => void }) {
  return (
    <>
      <div className="stats-grid">
        <StatCard icon={<Building2 size={22} />} label="Total tenants" value={numberValue(dashboard.clients?.totalClients)} tone="blue" />
        <StatCard icon={<Activity size={22} />} label="Active tenants" value={numberValue(dashboard.clients?.activeClients)} tone="green" />
        <StatCard icon={<UsersRound size={22} />} label="Total people" value={numberValue(dashboard.users?.totalUsers)} tone="ink" />
        <StatCard icon={<ShieldCheck size={22} />} label="Tenant admins" value={numberValue(dashboard.users?.clientAdmins)} tone="gold" />
      </div>

      <section className="dashboard-band">
        <div>
          <p className="eyebrow">System overview</p>
          <h2>Tenant operations</h2>
        </div>
        <div className="action-list">
          <button type="button" onClick={onOpenTenants}>
            <Building2 size={18} /> Manage tenants
          </button>
        </div>
      </section>
    </>
  );
}

function ClientDashboard({
  dashboard,
  onOpenUsers,
  onOpenAttendance
}: {
  dashboard: DashboardResponse;
  onOpenUsers: () => void;
  onOpenAttendance: () => void;
}) {
  const attendance = useMemo(() => {
    const rows = dashboard.todayAttendance ?? [];
    return {
      present: rows.find((row) => row.status === "present")?.count ?? 0,
      absent: rows.find((row) => row.status === "absent")?.count ?? 0,
      late: rows.find((row) => row.status === "late")?.count ?? 0,
      excused: rows.find((row) => row.status === "excused")?.count ?? 0
    };
  }, [dashboard.todayAttendance]);

  return (
    <>
      <div className="stats-grid">
        <StatCard icon={<UsersRound size={22} />} label="Total people" value={numberValue(dashboard.people?.totalPeople)} tone="blue" />
        <StatCard icon={<BadgeCheck size={22} />} label="Active people" value={numberValue(dashboard.people?.activePeople)} tone="green" />
        <StatCard icon={<CalendarDays size={22} />} label="Present today" value={numberValue(attendance.present)} tone="ink" />
        <StatCard icon={<CircleAlert size={22} />} label="Absent today" value={numberValue(attendance.absent)} tone="gold" />
      </div>

      <section className="dashboard-band">
        <div>
          <p className="eyebrow">Tenant tools</p>
          <h2>People and attendance</h2>
        </div>
        <div className="action-list">
          <button type="button" onClick={onOpenUsers}>
            <UsersRound size={18} /> Manage users
          </button>
          <button type="button" onClick={onOpenAttendance}>
            <ClipboardCheck size={18} /> Attendance
          </button>
        </div>
      </section>
    </>
  );
}

function MemberDashboard({ user }: { user: AuthUser }) {
  return (
    <section className="dashboard-band">
      <div>
        <p className="eyebrow">{roleLabel(user.role)}</p>
        <h2>{user.displayName}</h2>
      </div>
      <p className="muted">Your dashboard is active. More personal views will be added with the next feature slices.</p>
    </section>
  );
}

function TenantManagement({ token }: { token: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [personSingular, setPersonSingular] = useState("person");
  const [personPlural, setPersonPlural] = useState("people");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .tenants(token)
      .then((data) => setTenants(data.tenants))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load tenants"))
      .finally(() => setIsLoading(false));
  }, [token]);

  function handleTenantName(value: string) {
    setTenantName(value);
    setTenantSlug((current) => current || slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const tenant = await api.createTenant(token, {
        name: tenantName,
        slug: tenantSlug,
        personSingular,
        personPlural,
        admin: {
          displayName: adminName,
          email: adminEmail,
          password: adminPassword
        }
      });
      setTenants((current) => [tenant, ...current]);
      setTenantName("");
      setTenantSlug("");
      setPersonSingular("person");
      setPersonPlural("people");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setMessage("Tenant and tenant admin created");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create tenant");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tenant registration</p>
            <h2>Create tenant admin</h2>
          </div>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}

        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Tenant name
              <input value={tenantName} onChange={(event) => handleTenantName(event.target.value)} required />
            </label>
            <label>
              Tenant slug
              <input value={tenantSlug} onChange={(event) => setTenantSlug(slugify(event.target.value))} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Person label
              <input value={personSingular} onChange={(event) => setPersonSingular(event.target.value)} required />
            </label>
            <label>
              Plural label
              <input value={personPlural} onChange={(event) => setPersonPlural(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Admin name
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
            </label>
            <label>
              Admin email
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
            </label>
          </div>
          <label>
            Temporary password
            <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} minLength={8} required />
          </label>
          <button className="primary-button fit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Create tenant
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tenants</p>
            <h2>Registered tenants</h2>
          </div>
        </div>
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading tenants</div> : null}
        {!isLoading ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Terminology</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>{tenant.name}</td>
                    <td>{tenant.slug}</td>
                    <td>{tenant.personPlural}</td>
                    <td><span className="status-pill">{tenant.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function UsersManagement({ token }: { token: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"client_admin" | "user">("user");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .people(token)
      .then((data) => setPeople(data.people))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load users"))
      .finally(() => setIsLoading(false));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const person = await api.createPerson(token, { displayName, email, password, role });
      setPeople((current) => [person, ...current]);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setRole("user");
      setMessage(role === "client_admin" ? "Tenant admin created" : "User created");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tenant users</p>
            <h2>Create user or admin</h2>
          </div>
        </div>
        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Temporary password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
          <label>
            Role
            <select value={role} onChange={(event) => setRole(event.target.value as "client_admin" | "user")}>
              <option value="user">User</option>
              <option value="client_admin">Tenant admin</option>
            </select>
          </label>
          <button className="primary-button fit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Create account
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Users</h2>
          </div>
        </div>
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading users</div> : null}
        {!isLoading ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => (
                  <tr key={person.id}>
                    <td>{person.displayName}</td>
                    <td>{person.email}</td>
                    <td>{roleLabel(person.role)}</td>
                    <td><span className="status-pill">{person.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : "";
}

function AttendanceManagement({ token }: { token: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [personId, setPersonId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notes, setNotes] = useState("");
  const [filterDate, setFilterDate] = useState(todayIsoDate());
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadAttendance(date = filterDate) {
    const data = await api.attendance(token, { fromDate: date, toDate: date });
    setRecords(data.records);
  }

  useEffect(() => {
    Promise.all([api.people(token), api.attendance(token, { fromDate: filterDate, toDate: filterDate })])
      .then(([peopleData, attendanceData]) => {
        setPeople(peopleData.people.filter((person) => person.status === "active"));
        setRecords(attendanceData.records);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load attendance"))
      .finally(() => setIsLoading(false));
  }, [filterDate, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await api.createAttendance(token, {
        personId: Number(personId),
        attendanceDate,
        status,
        notes: notes || undefined
      });
      setPersonId("");
      setStatus("present");
      setNotes("");
      setFilterDate(attendanceDate);
      await loadAttendance(attendanceDate);
      setMessage("Attendance recorded");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record attendance");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Attendance</p>
            <h2>Record attendance</h2>
          </div>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            User
            <select value={personId} onChange={(event) => setPersonId(event.target.value)} required>
              <option value="">Select user</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName} ({roleLabel(person.role)})
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Date
              <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required />
            </label>
            <label>
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as AttendanceStatus)}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
          </label>
          <button className="primary-button fit" type="submit" disabled={isSubmitting || people.length === 0}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <ClipboardCheck size={18} />}
            Save attendance
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2>Daily attendance</h2>
          </div>
          <label className="inline-filter">
            Date
            <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
          </label>
        </div>

        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading attendance</div> : null}
        {!isLoading ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Recorded by</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id || `${record.personId}-${record.attendanceDate}`}>
                    <td>{record.personName}</td>
                    <td>{formatDate(record.attendanceDate)}</td>
                    <td><span className={`status-pill attendance-${record.status}`}>{record.status}</span></td>
                    <td>{record.recordedByName}</td>
                    <td>{record.notes || ""}</td>
                  </tr>
                ))}
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No attendance records for this date.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProfilePage({ session, onSessionChange }: { session: Session; onSessionChange: (session: Session) => void }) {
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [email, setEmail] = useState(session.user.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSavingProfile(true);

    try {
      const updated = await api.updateProfile(session.token, { displayName, email });
      const nextSession = { token: updated.token, user: updated.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      onSessionChange(nextSession);
      setMessage("Profile updated");
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Unable to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSavingPassword(true);

    try {
      await api.updatePassword(session.token, { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated");
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : "Unable to update password");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profile</p>
            <h2>Account details</h2>
          </div>
        </div>
        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        <form className="stack-form" onSubmit={handleProfileSubmit}>
          <label>
            Name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="primary-button fit" type="submit" disabled={isSavingProfile}>
            {isSavingProfile ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Save profile
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Security</p>
            <h2>Change password</h2>
          </div>
        </div>
        <form className="stack-form" onSubmit={handlePasswordSubmit}>
          <label>
            Current password
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
          </label>
          <label>
            New password
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required />
          </label>
          <button className="primary-button fit" type="submit" disabled={isSavingPassword}>
            {isSavingPassword ? <Loader2 className="spin" size={18} /> : <LockKeyhole size={18} />}
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}

function DashboardPage({
  session,
  onLogout,
  onSessionChange
}: {
  session: Session;
  onLogout: () => void;
  onSessionChange: (session: Session) => void;
}) {
  const [view, setView] = useState<View>("dashboard");
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    api
      .dashboard(session.token)
      .then((data) => {
        if (isMounted) setDashboard(data);
      })
      .catch((dashboardError) => {
        if (isMounted) setError(dashboardError instanceof Error ? dashboardError.message : "Unable to load dashboard");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session.token]);

  const pageTitle =
    view === "dashboard"
      ? "Dashboard"
      : view === "tenants"
        ? "Tenant management"
        : view === "users"
          ? "User management"
          : view === "attendance"
            ? "Attendance"
            : "Profile";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <UsersRound size={21} aria-hidden="true" />
          </div>
          <span>Personnel</span>
        </div>

        <nav aria-label="Primary navigation">
          <button className={view === "dashboard" ? "active" : ""} type="button" onClick={() => setView("dashboard")}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          {session.user.role === "super_admin" ? (
            <button className={view === "tenants" ? "active" : ""} type="button" onClick={() => setView("tenants")}>
              <Building2 size={18} />
              Tenants
            </button>
          ) : null}
          {session.user.role === "client_admin" ? (
            <>
              <button className={view === "users" ? "active" : ""} type="button" onClick={() => setView("users")}>
                <UsersRound size={18} />
                Users
              </button>
              <button className={view === "attendance" ? "active" : ""} type="button" onClick={() => setView("attendance")}>
                <ClipboardCheck size={18} />
                Attendance
              </button>
            </>
          ) : null}
          <button className={view === "profile" ? "active" : ""} type="button" onClick={() => setView("profile")}>
            <UserCog size={18} />
            Profile
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{roleLabel(session.user.role)}</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">
              <UserRound size={18} />
            </div>
            <div>
              <strong>{session.user.displayName}</strong>
              <span>{session.user.email}</span>
            </div>
            <button className="icon-button" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {view === "dashboard" && error ? <Alert message={error} /> : null}
        {view === "dashboard" && isLoading ? (
          <div className="loading-state">
            <Loader2 className="spin" size={24} />
            Loading dashboard
          </div>
        ) : null}

        {view === "dashboard" && !isLoading && dashboard && session.user.role === "super_admin" ? (
          <SystemDashboard dashboard={dashboard} onOpenTenants={() => setView("tenants")} />
        ) : null}
        {view === "dashboard" && !isLoading && dashboard && session.user.role === "client_admin" ? (
          <ClientDashboard dashboard={dashboard} onOpenUsers={() => setView("users")} onOpenAttendance={() => setView("attendance")} />
        ) : null}
        {view === "dashboard" && !isLoading && session.user.role === "user" ? <MemberDashboard user={session.user} /> : null}
        {view === "tenants" && session.user.role === "super_admin" ? <TenantManagement token={session.token} /> : null}
        {view === "users" && session.user.role === "client_admin" ? <UsersManagement token={session.token} /> : null}
        {view === "attendance" && session.user.role === "client_admin" ? <AttendanceManagement token={session.token} /> : null}
        {view === "profile" ? <ProfilePage session={session} onSessionChange={onSessionChange} /> : null}
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

  return <DashboardPage session={session} onLogout={handleLogout} onSessionChange={setSession} />;
}
