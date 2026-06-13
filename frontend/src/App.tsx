import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  FolderPlus,
  Eye,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Pencil,
  LogOut,
  Power,
  Plus,
  Save,
  Settings,
  ShieldCheck,
  UserCog,
  UserRound,
  UsersRound
} from "lucide-react";
import { ActionIconButton } from "./components/ActionIconButton";
import { ManagementPage } from "./components/ManagementPage";
import { PaginatedTable, type PaginatedTableColumn } from "./components/PaginatedTable";
import { SearchableMultiSelect } from "./components/SearchableMultiSelect";
import { SidebarGroup } from "./components/SidebarGroup";
import {
  api,
  type AttendanceAudience,
  type AttendanceRecord,
  type AttendanceStatus,
  type AuthUser,
  type AvailableSystem,
  type DashboardResponse,
  type MemberGroup,
  type Person,
  type Tenant,
  type TenantFeature,
  type TenantSystemSetting
} from "./lib/api";

const SESSION_KEY = "personnel_management_session";
const SAVE_CONFIRMATION_MESSAGE = "Save these changes?";
const DISCARD_CONFIRMATION_MESSAGE = "You have unsaved changes. Discard them?";

interface Session {
  token: string;
  user: AuthUser;
}

type View =
  | "dashboard"
  | "tenant-register"
  | "tenant-manage"
  | "system-dashboard"
  | "system-settings"
  | "system-tenant-settings"
  | "user-register"
  | "user-manage"
  | "user-detail"
  | "member-group-create"
  | "member-group-manage"
  | "member-group-detail"
  | "attendance-staff-record"
  | "attendance-staff-daily"
  | "attendance-member-record"
  | "attendance-member-daily"
  | "profile";

function pageTitleFor(view: View) {
  switch (view) {
    case "tenant-register":
      return "Tenant register";
    case "tenant-manage":
      return "Manage tenants";
    case "system-dashboard":
      return "System dashboard";
    case "system-settings":
      return "System settings";
    case "system-tenant-settings":
      return "Tenant system settings";
    case "user-register":
      return "User register";
    case "user-manage":
      return "Manage users";
    case "user-detail":
      return "User details";
    case "member-group-create":
      return "Create class";
    case "member-group-manage":
      return "Manage classes";
    case "member-group-detail":
      return "Class details";
    case "attendance-staff-record":
      return "Record staff attendance";
    case "attendance-staff-daily":
      return "Staff attendance";
    case "attendance-member-record":
      return "Record member attendance";
    case "attendance-member-daily":
      return "Member attendance";
    case "profile":
      return "Profile";
    default:
      return "Dashboard";
  }
}

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
  if (role === "tenant_admin") return "Tenant admin";
  if (role === "tenant_staff") return "Staff";
  return "Member";
}

function tenantRoleLabel(role: AuthUser["role"], tenant?: Tenant | null) {
  if (role === "tenant_staff") return `Staff / ${tenant?.staffSingular || "Staff"}`;
  if (role === "tenant_member") return `Member / ${tenant?.memberSingular || "Member"}`;
  return roleLabel(role);
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

function normalizeIdentifierInput(value: string) {
  return value.toUpperCase();
}

function isEnabled(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function confirmSaveChanges() {
  return window.confirm(SAVE_CONFIRMATION_MESSAGE);
}

function confirmDiscardChanges() {
  return window.confirm(DISCARD_CONFIRMATION_MESSAGE);
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
            Email or User ID
            <input value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} required />
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

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="required-label">
      {children}
      <span aria-hidden="true">*</span>
    </span>
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
        <StatCard icon={<ShieldCheck size={22} />} label="Tenant admins" value={numberValue(dashboard.users?.tenantAdmins)} tone="gold" />
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

function TenantAdminDashboard({
  dashboard,
  onOpenUsers,
  onOpenAttendance,
  onCreateUser
}: {
  dashboard: DashboardResponse;
  onOpenUsers: () => void;
  onCreateUser: () => void;
  onOpenAttendance: (() => void) | null;
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
          <p className="eyebrow">Tenant administration</p>
          <h2>Manage people and systems</h2>
        </div>
        <div className="action-list">
          <button type="button" onClick={onCreateUser}>
            <Plus size={18} /> Create user
          </button>
          <button type="button" onClick={onOpenUsers}>
            <UsersRound size={18} /> Manage users
          </button>
          {onOpenAttendance ? (
            <button type="button" onClick={onOpenAttendance}>
              <ClipboardCheck size={18} /> Attendance reports
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

function StaffDashboard({
  dashboard,
  onMarkAttendance,
  onOpenDailyAttendance
}: {
  dashboard: DashboardResponse;
  onMarkAttendance: (() => void) | null;
  onOpenDailyAttendance: (() => void) | null;
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
        <StatCard icon={<CalendarDays size={22} />} label="Present today" value={numberValue(attendance.present)} tone="green" />
        <StatCard icon={<CircleAlert size={22} />} label="Absent today" value={numberValue(attendance.absent)} tone="gold" />
        <StatCard icon={<Activity size={22} />} label="Late today" value={numberValue(attendance.late)} tone="blue" />
        <StatCard icon={<BadgeCheck size={22} />} label="Excused today" value={numberValue(attendance.excused)} tone="ink" />
      </div>

      <section className="dashboard-band">
        <div>
          <p className="eyebrow">Staff workspace</p>
          <h2>Attendance actions</h2>
        </div>
        <div className="action-list">
          {onMarkAttendance ? (
            <button className="primary-action-button" type="button" onClick={onMarkAttendance}>
              <ClipboardCheck size={18} /> Mark attendance
            </button>
          ) : null}
          {onOpenDailyAttendance ? (
            <button type="button" onClick={onOpenDailyAttendance}>
              <CalendarDays size={18} /> Daily attendance
            </button>
          ) : null}
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
      <p className="muted">Dashboard is active. Views to be added here.</p>
    </section>
  );
}

function TenantRegister({ token }: { token: string }) {
  const [tenantName, setTenantName] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [personSingular, setPersonSingular] = useState("person");
  const [personPlural, setPersonPlural] = useState("people");
  const [staffSingular, setStaffSingular] = useState("coach");
  const [staffPlural, setStaffPlural] = useState("coaches");
  const [memberSingular, setMemberSingular] = useState("student");
  const [memberPlural, setMemberPlural] = useState("students");
  const [userIdentifierLabel, setUserIdentifierLabel] = useState("User ID");
  const [newUserIdentifierLabel, setNewUserIdentifierLabel] = useState("New User ID");
  const [memberGroupSingular, setMemberGroupSingular] = useState("Class");
  const [memberGroupPlural, setMemberGroupPlural] = useState("Classes");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminUserIdentifier, setAdminUserIdentifier] = useState("");
  const [adminNewUserIdentifier, setAdminNewUserIdentifier] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await api.createTenant(token, {
        name: tenantName,
        slug: tenantSlug,
        personSingular,
        personPlural,
        staffSingular,
        staffPlural,
        memberSingular,
        memberPlural,
        userIdentifierLabel,
        newUserIdentifierLabel,
        memberGroupSingular,
        memberGroupPlural,
        admin: {
          displayName: adminName,
          email: adminEmail,
          userIdentifier: adminUserIdentifier || undefined,
          newUserIdentifier: adminNewUserIdentifier || undefined,
          password: adminPassword
        }
      });
      setTenantName("");
      setTenantSlug("");
      setPersonSingular("person");
      setPersonPlural("people");
      setStaffSingular("coach");
      setStaffPlural("coaches");
      setMemberSingular("student");
      setMemberPlural("students");
      setUserIdentifierLabel("User ID");
      setNewUserIdentifierLabel("New User ID");
      setMemberGroupSingular("Class");
      setMemberGroupPlural("Classes");
      setAdminName("");
      setAdminEmail("");
      setAdminUserIdentifier("");
      setAdminNewUserIdentifier("");
      setAdminPassword("");
      setMessage("Tenant and tenant admin created");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create tenant");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tenant registration</p>
            <h2>Create tenant admin</h2>
          </div>
          <span className="required-note"><span aria-hidden="true">*</span> Required fields</span>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}

        <form className="stack-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              <RequiredLabel>Tenant name</RequiredLabel>
              <input value={tenantName} onChange={(event) => handleTenantName(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>Tenant slug</RequiredLabel>
              <input value={tenantSlug} onChange={(event) => setTenantSlug(slugify(event.target.value))} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>General person label</RequiredLabel>
              <input value={personSingular} onChange={(event) => setPersonSingular(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>General plural label</RequiredLabel>
              <input value={personPlural} onChange={(event) => setPersonPlural(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>Staff label</RequiredLabel>
              <input value={staffSingular} onChange={(event) => setStaffSingular(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>Staff plural label</RequiredLabel>
              <input value={staffPlural} onChange={(event) => setStaffPlural(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>Member label</RequiredLabel>
              <input value={memberSingular} onChange={(event) => setMemberSingular(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>Member plural label</RequiredLabel>
              <input value={memberPlural} onChange={(event) => setMemberPlural(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>User ID label</RequiredLabel>
              <input value={userIdentifierLabel} onChange={(event) => setUserIdentifierLabel(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>New User ID label</RequiredLabel>
              <input value={newUserIdentifierLabel} onChange={(event) => setNewUserIdentifierLabel(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>Member group label</RequiredLabel>
              <input value={memberGroupSingular} onChange={(event) => setMemberGroupSingular(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>Member group plural label</RequiredLabel>
              <input value={memberGroupPlural} onChange={(event) => setMemberGroupPlural(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              <RequiredLabel>Admin name</RequiredLabel>
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} required />
            </label>
            <label>
              <RequiredLabel>Admin email</RequiredLabel>
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              {userIdentifierLabel}
              <input value={adminUserIdentifier} onChange={(event) => setAdminUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
            <label>
              {newUserIdentifierLabel}
              <input value={adminNewUserIdentifier} onChange={(event) => setAdminNewUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
          </div>
          <label>
            <RequiredLabel>Temporary password</RequiredLabel>
            <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} minLength={8} required />
          </label>
          <button className="primary-button fit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Create tenant
          </button>
        </form>
      </section>

    </div>
  );
}

type TenantAction = "view" | "edit" | "settings" | null;

function ManageTenants({ token }: { token: string }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [action, setAction] = useState<TenantAction>(null);
  const [features, setFeatures] = useState<TenantFeature[]>([]);
  const [editForm, setEditForm] = useState<Omit<Tenant, "id" | "createdAt"> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadTenants = useCallback(async () => {
    const data = await api.tenants(token);
    setTenants(data.tenants);
  }, [token]);

  useEffect(() => {
    loadTenants()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load tenants"))
      .finally(() => setIsLoading(false));
  }, [loadTenants]);

  function openView(tenant: Tenant) {
    setSelectedTenant(tenant);
    setAction("view");
    setError("");
    setMessage("");
  }

  function openEdit(tenant: Tenant) {
    setSelectedTenant(tenant);
    setEditForm({
      name: tenant.name,
      slug: tenant.slug,
      personSingular: tenant.personSingular,
      personPlural: tenant.personPlural,
      staffSingular: tenant.staffSingular,
      staffPlural: tenant.staffPlural,
      memberSingular: tenant.memberSingular,
      memberPlural: tenant.memberPlural,
      userIdentifierLabel: tenant.userIdentifierLabel,
      newUserIdentifierLabel: tenant.newUserIdentifierLabel,
      memberGroupSingular: tenant.memberGroupSingular,
      memberGroupPlural: tenant.memberGroupPlural,
      status: tenant.status
    });
    setAction("edit");
    setError("");
    setMessage("");
  }

  async function openSettings(tenant: Tenant) {
    setSelectedTenant(tenant);
    setAction("settings");
    setError("");
    setMessage("");
    try {
      const data = await api.tenantFeatures(token, tenant.id);
      setFeatures(data.features);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Unable to load tenant settings");
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant || !editForm) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await api.updateTenant(token, selectedTenant.id, editForm);
      await loadTenants();
      setSelectedTenant({ ...selectedTenant, ...editForm });
      setMessage("Tenant updated");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update tenant");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(tenant: Tenant, status: Tenant["status"]) {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (status === "inactive") {
        await api.deactivateTenant(token, tenant.id);
      } else {
        await api.updateTenant(token, tenant.id, { status: "active" });
      }
      await loadTenants();
      setMessage(status === "inactive" ? "Tenant deactivated" : "Tenant reactivated");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update tenant status");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFeatureSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTenant) return;
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await api.updateTenantFeatures(
        token,
        selectedTenant.id,
        Object.fromEntries(features.map((feature) => [feature.code, Boolean(feature.enabled)]))
      );
      setMessage("Tenant settings updated");
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Unable to update tenant settings");
    } finally {
      setIsSaving(false);
    }
  }

  const tenantColumns: PaginatedTableColumn<Tenant>[] = [
    {
      header: "Name",
      render: (tenant) => tenant.name
    },
    {
      header: "Slug",
      render: (tenant) => tenant.slug
    },
    {
      header: "Terminology",
      render: (tenant) => `${tenant.staffPlural} / ${tenant.memberPlural}`
    },
    {
      header: "Status",
      render: (tenant) => <span className="status-pill">{tenant.status}</span>
    },
    {
      header: "Actions",
      render: (tenant) => (
        <div className="table-actions">
          <ActionIconButton label={`View ${tenant.name}`} title="View tenant" onClick={() => openView(tenant)}>
            <Eye size={16} />
          </ActionIconButton>
          <ActionIconButton label={`Edit ${tenant.name}`} title="Edit tenant" onClick={() => openEdit(tenant)}>
            <Pencil size={16} />
          </ActionIconButton>
          <ActionIconButton label={`Configure ${tenant.name}`} title="Tenant settings" onClick={() => openSettings(tenant)}>
            <Settings size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={`${tenant.status === "active" ? "Deactivate" : "Reactivate"} ${tenant.name}`}
            title={tenant.status === "active" ? "Deactivate tenant" : "Reactivate tenant"}
            onClick={() => handleStatusChange(tenant, tenant.status === "active" ? "inactive" : "active")}
          >
            <Power size={16} />
          </ActionIconButton>
        </div>
      )
    }
  ];

  return (
    <div className="page-stack">
      {message ? <Alert tone="success" message={message} /> : null}
      {error ? <Alert message={error} /> : null}

      {selectedTenant && action ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{action === "view" ? "Tenant details" : action === "edit" ? "Edit tenant" : "Tenant settings"}</p>
              <h2>{selectedTenant.name}</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => (confirmDiscardChanges() ? setAction(null) : undefined)}>Close</button>
          </div>

          {action === "view" ? (
            <div className="detail-grid">
              <div><span>Name</span><strong>{selectedTenant.name}</strong></div>
              <div><span>Slug</span><strong>{selectedTenant.slug}</strong></div>
              <div><span>Staff label</span><strong>{selectedTenant.staffSingular} / {selectedTenant.staffPlural}</strong></div>
              <div><span>Member label</span><strong>{selectedTenant.memberSingular} / {selectedTenant.memberPlural}</strong></div>
              <div><span>User ID label</span><strong>{selectedTenant.userIdentifierLabel}</strong></div>
              <div><span>New User ID label</span><strong>{selectedTenant.newUserIdentifierLabel}</strong></div>
              <div><span>Member group label</span><strong>{selectedTenant.memberGroupSingular} / {selectedTenant.memberGroupPlural}</strong></div>
              <div><span>Status</span><strong>{selectedTenant.status}</strong></div>
            </div>
          ) : null}

          {action === "edit" && editForm ? (
            <form className="stack-form" onSubmit={handleEditSubmit}>
              <div className="form-row">
                <label>Name<input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} required /></label>
                <label>Slug<input value={editForm.slug} onChange={(event) => setEditForm({ ...editForm, slug: slugify(event.target.value) })} required /></label>
              </div>
              <div className="form-row">
                <label>Staff label<input value={editForm.staffSingular} onChange={(event) => setEditForm({ ...editForm, staffSingular: event.target.value })} required /></label>
                <label>Staff plural label<input value={editForm.staffPlural} onChange={(event) => setEditForm({ ...editForm, staffPlural: event.target.value })} required /></label>
              </div>
              <div className="form-row">
                <label>Member label<input value={editForm.memberSingular} onChange={(event) => setEditForm({ ...editForm, memberSingular: event.target.value })} required /></label>
                <label>Member plural label<input value={editForm.memberPlural} onChange={(event) => setEditForm({ ...editForm, memberPlural: event.target.value })} required /></label>
              </div>
              <div className="form-row">
                <label>User ID label<input value={editForm.userIdentifierLabel} onChange={(event) => setEditForm({ ...editForm, userIdentifierLabel: event.target.value })} required /></label>
                <label>New User ID label<input value={editForm.newUserIdentifierLabel} onChange={(event) => setEditForm({ ...editForm, newUserIdentifierLabel: event.target.value })} required /></label>
              </div>
              <div className="form-row">
                <label>Member group label<input value={editForm.memberGroupSingular} onChange={(event) => setEditForm({ ...editForm, memberGroupSingular: event.target.value })} required /></label>
                <label>Member group plural label<input value={editForm.memberGroupPlural} onChange={(event) => setEditForm({ ...editForm, memberGroupPlural: event.target.value })} required /></label>
              </div>
              <label>Status
                <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value as Tenant["status"] })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <button className="primary-button fit" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                Save tenant
              </button>
            </form>
          ) : null}

          {action === "settings" ? (
            <form className="stack-form" onSubmit={handleFeatureSubmit}>
              {features.map((feature) => (
                <label className="toggle-row" key={feature.code}>
                  <span>
                    <strong>{feature.name}</strong>
                    <small>{feature.description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(feature.enabled)}
                    onChange={(event) =>
                      setFeatures((current) =>
                        current.map((item) => (item.code === feature.code ? { ...item, enabled: event.target.checked } : item))
                      )
                    }
                  />
                </label>
              ))}
              <button className="primary-button fit" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" size={18} /> : <Settings size={18} />}
                Save settings
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <ManagementPage eyebrow="Tenants" title="Manage tenants">
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading tenants</div> : null}
        {!isLoading ? (
          <PaginatedTable columns={tenantColumns} emptyMessage="No tenants found." getRowKey={(tenant) => tenant.id} rows={tenants} />
        ) : null}
      </ManagementPage>
    </div>
  );
}

function SystemDashboardPage({
  systemCode,
  token,
  onOpenSystemSettings,
  onOpenTenantSettings
}: {
  systemCode: string;
  token: string;
  onOpenSystemSettings: () => void;
  onOpenTenantSettings: () => void;
}) {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof api.systemDashboard>> | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api
      .systemDashboard(token, systemCode)
      .then(setDashboard)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load system"))
      .finally(() => setIsLoading(false));
  }, [systemCode, token]);

  return (
    <div className="page-stack">
      {error ? <Alert message={error} /> : null}
      {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading system</div> : null}
      {!isLoading && dashboard ? (
        <>
          <div className="stats-grid">
            <StatCard icon={<Building2 size={22} />} label="Total tenants" value={numberValue(dashboard.stats.totalTenants)} tone="blue" />
            <StatCard icon={<Activity size={22} />} label="Enabled tenants" value={numberValue(dashboard.stats.enabledTenants)} tone="green" />
            <StatCard icon={<UsersRound size={22} />} label="Staff attendance" value={numberValue(dashboard.stats.staffAttendanceTenants)} tone="ink" />
            <StatCard icon={<CalendarDays size={22} />} label="Member attendance" value={numberValue(dashboard.stats.memberAttendanceTenants)} tone="gold" />
          </div>

          <section className="dashboard-band">
            <div>
              <p className="eyebrow">Available system</p>
              <h2>{dashboard.system.name}</h2>
            </div>
            <div className="action-list">
              <button type="button" onClick={onOpenSystemSettings}>
                <Settings size={18} /> System Settings
              </button>
              <button type="button" onClick={onOpenTenantSettings}>
                <Building2 size={18} /> Tenant Level Settings
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SystemSettingsPage({ systemCode, token }: { systemCode: string; token: string }) {
  const [system, setSystem] = useState<AvailableSystem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [defaultAttendanceStatus, setDefaultAttendanceStatus] = useState<AttendanceStatus>("present");
  const [notesEnabled, setNotesEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    api
      .systemSettings(token, systemCode)
      .then((data) => {
        setSystem(data.system);
        setName(data.system.name);
        setDescription(data.system.description ?? "");
        setStatus(data.system.status);
        setDefaultAttendanceStatus((data.settings.find((setting) => setting.key === "default_attendance_status")?.value as AttendanceStatus | undefined) ?? "present");
        setNotesEnabled(isEnabled(data.settings.find((setting) => setting.key === "notes_enabled")?.value ?? "true"));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load settings"))
      .finally(() => setIsLoading(false));
  }, [systemCode, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await api.updateSystemSettings(token, systemCode, {
        name,
        description: description || null,
        status,
        settings: {
          defaultAttendanceStatus,
          notesEnabled
        }
      });
      setMessage("System settings updated");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save system settings");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      {message ? <Alert tone="success" message={message} /> : null}
      {error ? <Alert message={error} /> : null}
      <ManagementPage eyebrow={system?.name || "System"} title="System Settings">
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading settings</div> : null}
        {!isLoading ? (
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                System name
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
            {systemCode === "attendance" ? (
              <div className="form-row">
                <label>
                  Default attendance status
                  <select value={defaultAttendanceStatus} onChange={(event) => setDefaultAttendanceStatus(event.target.value as AttendanceStatus)}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </label>
                <label className="toggle-row">
                  <span>
                    <strong>Notes enabled</strong>
                    <small>Allow notes while recording attendance.</small>
                  </span>
                  <input type="checkbox" checked={notesEnabled} onChange={(event) => setNotesEnabled(event.target.checked)} />
                </label>
              </div>
            ) : null}
            <button className="primary-button fit" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              Save settings
            </button>
          </form>
        ) : null}
      </ManagementPage>
    </div>
  );
}

function TenantSystemSettingsPage({ systemCode, token }: { systemCode: string; token: string }) {
  const [tenantSettings, setTenantSettings] = useState<TenantSystemSetting[]>([]);
  const [draftSettings, setDraftSettings] = useState<Record<number, { enabled: boolean; staffAttendanceEnabled: boolean; memberAttendanceEnabled: boolean }>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await api.systemTenantSettings(token, systemCode);
    setTenantSettings(data.tenantSettings);
    setDraftSettings(
      Object.fromEntries(
        data.tenantSettings.map((tenant) => [
          tenant.tenantId,
          {
            enabled: isEnabled(tenant.enabled),
            staffAttendanceEnabled: isEnabled(tenant.staffAttendanceEnabled),
            memberAttendanceEnabled: isEnabled(tenant.memberAttendanceEnabled)
          }
        ])
      )
    );
  }, [systemCode, token]);

  useEffect(() => {
    loadSettings()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load tenant settings"))
      .finally(() => setIsLoading(false));
  }, [loadSettings]);

  function updateTenantDraft(tenantId: number, patch: Partial<{ enabled: boolean; staffAttendanceEnabled: boolean; memberAttendanceEnabled: boolean }>) {
    setDraftSettings((current) => ({
      ...current,
      [tenantId]: {
        enabled: current[tenantId]?.enabled ?? false,
        staffAttendanceEnabled: current[tenantId]?.staffAttendanceEnabled ?? false,
        memberAttendanceEnabled: current[tenantId]?.memberAttendanceEnabled ?? false,
        ...patch
      }
    }));
  }

  async function handleTenantSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await Promise.all(
        tenantSettings.map((tenant) => {
          const draft = draftSettings[tenant.tenantId];
          return api.updateSystemTenantSettings(token, systemCode, tenant.tenantId, {
            enabled: draft?.enabled ?? false,
            settings: {
              staffAttendanceEnabled: draft?.staffAttendanceEnabled ?? false,
              memberAttendanceEnabled: draft?.memberAttendanceEnabled ?? false
            }
          });
        })
      );
      await loadSettings();
      setMessage("Tenant system settings updated");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save tenant settings");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: PaginatedTableColumn<TenantSystemSetting>[] = [
    { header: "Tenant", render: (tenant) => tenant.tenantName },
    { header: "Slug", render: (tenant) => tenant.tenantSlug },
    {
      header: "System",
      render: (tenant) => (
        <label className="table-toggle">
          <input
            type="checkbox"
            checked={draftSettings[tenant.tenantId]?.enabled ?? false}
            disabled={isSaving}
            onChange={(event) => updateTenantDraft(tenant.tenantId, { enabled: event.target.checked })}
          />
          Enabled
        </label>
      )
    },
    {
      header: "Staff",
      render: (tenant) => (
        <label className="table-toggle">
          <input
            type="checkbox"
            checked={draftSettings[tenant.tenantId]?.staffAttendanceEnabled ?? false}
            disabled={isSaving}
            onChange={(event) => updateTenantDraft(tenant.tenantId, { staffAttendanceEnabled: event.target.checked })}
          />
          Attendance
        </label>
      )
    },
    {
      header: "Member",
      render: (tenant) => (
        <label className="table-toggle">
          <input
            type="checkbox"
            checked={draftSettings[tenant.tenantId]?.memberAttendanceEnabled ?? false}
            disabled={isSaving}
            onChange={(event) => updateTenantDraft(tenant.tenantId, { memberAttendanceEnabled: event.target.checked })}
          />
          Attendance
        </label>
      )
    }
  ];

  return (
    <div className="page-stack">
      {message ? <Alert tone="success" message={message} /> : null}
      {error ? <Alert message={error} /> : null}
      <ManagementPage eyebrow="Tenant settings" title="Tenant Level Settings">
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading tenant settings</div> : null}
        {!isLoading ? (
          <form className="stack-form" onSubmit={handleTenantSettingsSubmit}>
            <PaginatedTable columns={columns} getRowKey={(tenant) => tenant.tenantId} rows={tenantSettings} />
            <button className="primary-button fit" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              Save tenant settings
            </button>
          </form>
        ) : null}
      </ManagementPage>
    </div>
  );
}

type UserRole = "tenant_admin" | "tenant_staff" | "tenant_member";

function UserRegister({ token, actorRole }: { token: string; actorRole: AuthUser["role"] }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [userIdentifier, setUserIdentifier] = useState("");
  const [newUserIdentifier, setNewUserIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("tenant_member");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api
      .currentTenant(token)
      .then((tenantData) => setTenant(tenantData.tenant))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load tenant labels"));
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await api.createPerson(token, {
        displayName,
        email,
        userIdentifier: userIdentifier || undefined,
        newUserIdentifier: newUserIdentifier || undefined,
        password,
        role
      });
      setDisplayName("");
      setEmail("");
      setUserIdentifier("");
      setNewUserIdentifier("");
      setPassword("");
      setRole("tenant_member");
      setMessage(
        role === "tenant_admin"
          ? "Tenant admin created"
          : role === "tenant_staff"
            ? `${tenant?.staffSingular || "Staff"} account created`
            : `${tenant?.memberSingular || "Member"} account created`
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create user");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Tenant users</p>
            <h2>
              {actorRole === "tenant_staff"
                ? `Create member / ${tenant?.memberSingular || "member"}`
                : `Create member / ${tenant?.memberSingular || "member"}, staff / ${tenant?.staffSingular || "staff"}, or admin`}
            </h2>
          </div>
        </div>
        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
          </label>
          <div className="form-row">
            <label>
              {tenant?.userIdentifierLabel || "User ID"}
              <input value={userIdentifier} onChange={(event) => setUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
            <label>
              {tenant?.newUserIdentifierLabel || "New User ID"}
              <input value={newUserIdentifier} onChange={(event) => setNewUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
          </div>
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
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
              <option value="tenant_member">Member / {tenant?.memberSingular || "Member"}</option>
              {actorRole === "tenant_admin" ? (
                <>
                  <option value="tenant_staff">Staff / {tenant?.staffSingular || "Staff"}</option>
                  <option value="tenant_admin">Tenant admin</option>
                </>
              ) : null}
            </select>
          </label>
          <button className="primary-button fit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Create account
          </button>
        </form>
      </section>
    </div>
  );
}

function ManageUsers({
  token,
  onOpenUser
}: {
  token: string;
  onOpenUser: (userId: number) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.people(token), api.currentTenant(token), api.memberGroups(token)])
      .then(([peopleData, tenantData, groupsData]) => {
        setPeople(peopleData.people);
        setTenant(tenantData.tenant);
        setGroups(groupsData.groups.filter((group) => group.status === "active"));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load users"))
      .finally(() => setIsLoading(false));
  }, [token]);

  const filteredPeople = useMemo(() => {
    if (!selectedGroupId) return people;
    const group = groups.find((item) => String(item.id) === selectedGroupId);
    if (!group) return [];
    const memberIds = new Set(groupMembers(group).map((member) => Number(member.id)));
    return people.filter((person) => person.role === "tenant_member" && memberIds.has(person.id));
  }, [groups, people, selectedGroupId]);

  const userColumns: PaginatedTableColumn<Person>[] = [
    {
      header: "Name",
      render: (person) => person.displayName
    },
    {
      header: "Email",
      render: (person) => person.email
    },
    {
      header: tenant?.userIdentifierLabel || "User ID",
      render: (person) => person.userIdentifier || ""
    },
    {
      header: tenant?.newUserIdentifierLabel || "New User ID",
      render: (person) => person.newUserIdentifier || ""
    },
    {
      header: "Role",
      render: (person) => tenantRoleLabel(person.role, tenant)
    },
    {
      header: "Status",
      render: (person) => <span className="status-pill">{person.status}</span>
    },
    {
      header: "Actions",
      render: (person) => (
        <div className="table-actions">
          <ActionIconButton label={`Manage ${person.displayName}`} title="Manage user" onClick={() => onOpenUser(person.id)}>
            <Pencil size={16} />
          </ActionIconButton>
        </div>
      )
    }
  ];

  return (
    <div className="page-stack">
      {error ? <Alert message={error} /> : null}

      <ManagementPage eyebrow="Directory" title="Manage users">
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading users</div> : null}
        {!isLoading ? (
          <>
            <div className="management-filter-bar">
              <label className="inline-filter">
                {tenant?.memberGroupSingular || "Class"}
                <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                  <option value="">All users</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <PaginatedTable columns={userColumns} emptyMessage="No users found." getRowKey={(person) => person.id} rows={filteredPeople} />
          </>
        ) : null}
      </ManagementPage>
    </div>
  );
}

function groupMembers(group: MemberGroup) {
  if (Array.isArray(group.members)) return group.members.filter((member): member is { id: number; displayName: string } => Boolean(member));
  if (!group.members) return [];

  try {
    const parsed = JSON.parse(group.members);
    return Array.isArray(parsed) ? parsed.filter((member) => member && member.id && member.displayName) : [];
  } catch {
    return [];
  }
}

function ManageMemberGroups({
  token,
  onCreateGroup,
  onOpenGroup
}: {
  token: string;
  onCreateGroup: () => void;
  onOpenGroup: (groupId: number) => void;
}) {
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadGroups = useCallback(async () => {
    const [groupsData, tenantData] = await Promise.all([api.memberGroups(token), api.currentTenant(token)]);
    setGroups(groupsData.groups);
    setTenant(tenantData.tenant);
  }, [token]);

  useEffect(() => {
    loadGroups()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load groups"))
      .finally(() => setIsLoading(false));
  }, [loadGroups]);

  async function handleDeactivate(group: MemberGroup) {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (group.status === "active") {
        await api.deactivateMemberGroup(token, group.id);
        setMessage(`${tenant?.memberGroupSingular || "Class"} deactivated`);
      } else {
        await api.updateMemberGroup(token, group.id, { status: "active" });
        setMessage(`${tenant?.memberGroupSingular || "Class"} reactivated`);
      }
      await loadGroups();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update group");
    } finally {
      setIsSaving(false);
    }
  }

  const columns: PaginatedTableColumn<MemberGroup>[] = [
    { header: "Name", render: (group) => group.name },
    { header: "Members", render: (group) => numberValue(group.memberCount) },
    { header: "Status", render: (group) => <span className="status-pill">{group.status}</span> },
    { header: "Created by", render: (group) => group.createdByName || "" },
    {
      header: "Actions",
      render: (group) => (
        <div className="table-actions">
          <ActionIconButton label={`Manage ${group.name}`} title="Manage group" onClick={() => onOpenGroup(group.id)}>
            <Pencil size={16} />
          </ActionIconButton>
          <ActionIconButton
            label={`${group.status === "active" ? "Deactivate" : "Reactivate"} ${group.name}`}
            title={group.status === "active" ? "Deactivate group" : "Reactivate group"}
            onClick={() => handleDeactivate(group)}
          >
            <Power size={16} />
          </ActionIconButton>
        </div>
      )
    }
  ];

  return (
    <div className="page-stack">
      {message ? <Alert tone="success" message={message} /> : null}
      {error ? <Alert message={error} /> : null}
      <ManagementPage
        eyebrow="Member groups"
        title={`Manage ${tenant?.memberGroupPlural || "Classes"}`}
        actions={
          <button className="primary-button fit" type="button" onClick={onCreateGroup}>
            <FolderPlus size={18} />
            Create {tenant?.memberGroupSingular || "class"}
          </button>
        }
      >
        {isSaving ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Saving group</div> : null}
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading groups</div> : null}
        {!isLoading ? (
          <PaginatedTable
            columns={columns}
            emptyMessage={`No ${tenant?.memberGroupPlural?.toLowerCase() || "classes"} found.`}
            getRowKey={(group) => group.id}
            rows={groups}
          />
        ) : null}
      </ManagementPage>
    </div>
  );
}

function MemberGroupDetailsPage({
  token,
  groupId,
  onBack
}: {
  token: string;
  groupId?: number;
  onBack: () => void;
}) {
  const isCreateMode = groupId === undefined;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.currentTenant(token), api.people(token), api.memberGroups(token)])
      .then(([tenantData, peopleData, groupsData]) => {
        setTenant(tenantData.tenant);
        setMembers(peopleData.people.filter((person) => person.role === "tenant_member" && person.status === "active"));

        if (!isCreateMode) {
          const group = groupsData.groups.find((item) => item.id === groupId);
          if (!group) throw new Error("Group not found");
          setName(group.name);
          setDescription(group.description ?? "");
          setStatus(group.status);
          setSelectedMemberIds(groupMembers(group).map((member) => Number(member.id)));
        }
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load group"))
      .finally(() => setIsLoading(false));
  }, [groupId, isCreateMode, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (isCreateMode) {
        await api.createMemberGroup(token, {
          name,
          description: description || null,
          status,
          memberIds: selectedMemberIds
        });
        setName("");
        setDescription("");
        setStatus("active");
        setSelectedMemberIds([]);
        setMessage(`${tenant?.memberGroupSingular || "Class"} created`);
      } else {
        await api.updateMemberGroup(token, groupId, {
          name,
          description: description || null,
          status,
          memberIds: selectedMemberIds
        });
        setMessage(`${tenant?.memberGroupSingular || "Class"} updated`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save group");
    } finally {
      setIsSaving(false);
    }
  }

  const memberOptions = members.map((member) => ({
    id: member.id,
    label: member.displayName,
    meta: member.userIdentifier || member.email
  }));

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Member groups</p>
            <h2>{isCreateMode ? `Create ${tenant?.memberGroupSingular || "class"}` : name || `Manage ${tenant?.memberGroupSingular || "class"}`}</h2>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>Back</button>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading group</div> : null}

        {!isLoading ? (
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>
                <RequiredLabel>{tenant?.memberGroupSingular || "Class"} name</RequiredLabel>
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label>
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
            </label>
            <SearchableMultiSelect
              label={tenant?.memberPlural || "Members"}
              options={memberOptions}
              placeholder={`Assign ${tenant?.memberPlural || "members"}`}
              selectedIds={selectedMemberIds}
              selectAllLabel={`Select all ${tenant?.memberPlural || "members"}`}
              onChange={setSelectedMemberIds}
            />
            <button className="primary-button fit" type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              Save {tenant?.memberGroupSingular || "class"}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function UserDetailsPage({
  token,
  actorRole,
  userId,
  onBack
}: {
  token: string;
  actorRole: AuthUser["role"];
  userId: number;
  onBack: () => void;
}) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [userIdentifier, setUserIdentifier] = useState("");
  const [newUserIdentifier, setNewUserIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("tenant_member");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.people(token), api.currentTenant(token)])
      .then(([peopleData, tenantData]) => {
        const person = peopleData.people.find((item) => item.id === userId);
        if (!person) throw new Error("User not found");
        setDisplayName(person.displayName);
        setEmail(person.email);
        setUserIdentifier(person.userIdentifier ?? "");
        setNewUserIdentifier(person.newUserIdentifier ?? "");
        setRole(person.role);
        setStatus(person.status);
        setTenant(tenantData.tenant);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load user"))
      .finally(() => setIsLoading(false));
  }, [token, userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      await api.updatePerson(token, userId, {
        displayName,
        email,
        userIdentifier: userIdentifier || null,
        newUserIdentifier: newUserIdentifier || null,
        role,
        status,
        ...(password ? { password } : {})
      });
      setPassword("");
      setMessage("User updated");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update user");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivate() {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (status === "active") {
        await api.deactivatePerson(token, userId);
        setStatus("inactive");
        setMessage("User deactivated");
      } else {
        await api.updatePerson(token, userId, { status: "active" });
        setStatus("active");
        setMessage("User reactivated");
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update user status");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">User details</p>
            <h2>{displayName || "Manage user"}</h2>
          </div>
          <button className="secondary-button" type="button" onClick={onBack}>Back</button>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading user</div> : null}

        {!isLoading ? (
          <form className="stack-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            </div>
            <div className="form-row">
              <label>{tenant?.userIdentifierLabel || "User ID"}<input value={userIdentifier} onChange={(event) => setUserIdentifier(normalizeIdentifierInput(event.target.value))} /></label>
              <label>{tenant?.newUserIdentifierLabel || "New User ID"}<input value={newUserIdentifier} onChange={(event) => setNewUserIdentifier(normalizeIdentifierInput(event.target.value))} /></label>
            </div>
            <div className="form-row">
              <label>
                Role
                <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                  <option value="tenant_member">Member / {tenant?.memberSingular || "Member"}</option>
                  {actorRole === "tenant_admin" ? (
                    <>
                      <option value="tenant_staff">Staff / {tenant?.staffSingular || "Staff"}</option>
                      <option value="tenant_admin">Tenant admin</option>
                    </>
                  ) : null}
                </select>
              </label>
              <label>
                Status
                <select value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} /></label>
            <div className="form-actions">
              <button className="primary-button fit" type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                Save user
              </button>
              <button className="secondary-button" type="button" onClick={handleDeactivate} disabled={isSaving}>
                <Power size={18} />
                {status === "active" ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          </form>
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

function attendanceColumns(): PaginatedTableColumn<AttendanceRecord>[] {
  return [
    {
      header: "User",
      render: (record) => record.personName
    },
    {
      header: "Date",
      render: (record) => formatDate(record.attendanceDate)
    },
    {
      header: "Status",
      render: (record) => <span className={`status-pill attendance-${record.status}`}>{record.status}</span>
    },
    {
      header: "Recorded by",
      render: (record) => record.recordedByName
    },
    {
      header: "Notes",
      render: (record) => record.notes || ""
    }
  ];
}

function attendanceAudienceRole(audience: AttendanceAudience) {
  return audience === "staff" ? "tenant_staff" : "tenant_member";
}

function RecordAttendancePage({ audience, token }: { audience: AttendanceAudience; token: string }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<number[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [status, setStatus] = useState<AttendanceStatus>("present");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([api.people(token), api.currentTenant(token), audience === "member" ? api.memberGroups(token) : Promise.resolve({ groups: [] })])
      .then(([peopleData, tenantData, groupsData]) => {
        setPeople(peopleData.people.filter((person) => person.status === "active" && person.role === attendanceAudienceRole(audience)));
        setTenant(tenantData.tenant);
        setGroups(groupsData.groups.filter((group) => group.status === "active"));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load attendance form"))
      .finally(() => setIsLoading(false));
  }, [audience, token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedPersonIds.length === 0) {
      setError(`Select at least one ${audience === "staff" ? tenant?.staffSingular || "staff" : tenant?.memberSingular || "member"}`);
      return;
    }

    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      await Promise.all(
        selectedPersonIds.map((personId) =>
          api.createAttendance(token, {
            personId,
            audience,
            attendanceDate,
            status,
            notes: notes || undefined
          })
        )
      );
      setSelectedPersonIds([]);
      setStatus("present");
      setNotes("");
      setMessage(`${selectedPersonIds.length} attendance record${selectedPersonIds.length === 1 ? "" : "s"} saved`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to record attendance");
    } finally {
      setIsSubmitting(false);
    }
  }

  const personOptions = people.map((person) => ({
    id: person.id,
    label: person.displayName,
    meta: tenantRoleLabel(person.role, tenant)
  }));
  const pluralLabel = audience === "staff" ? tenant?.staffPlural || "staff" : tenant?.memberPlural || "members";
  const groupLabel = tenant?.memberGroupSingular || "Class";

  function handleGroupSelection(groupId: string) {
    setSelectedGroupId(groupId);
    if (!groupId) return;
    const group = groups.find((item) => String(item.id) === groupId);
    if (!group) return;
    const groupMemberIds = groupMembers(group).map((member) => Number(member.id));
    setSelectedPersonIds(people.filter((person) => groupMemberIds.includes(person.id)).map((person) => person.id));
  }

  return (
    <div className="page-stack">
      <section className="panel compact-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Attendance</p>
            <h2>Record {pluralLabel} attendance</h2>
          </div>
        </div>

        {message ? <Alert tone="success" message={message} /> : null}
        {error ? <Alert message={error} /> : null}
        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading attendance form</div> : null}

        {!isLoading ? (
          <form className="stack-form attendance-record-form" onSubmit={handleSubmit}>
            <div className="attendance-record-summary">
              <span>{people.length} available</span>
              <strong>{selectedPersonIds.length} selected</strong>
            </div>
            <div className="attendance-selection-row">
              <div className="attendance-selection-main">
                <SearchableMultiSelect
                  label={pluralLabel}
                  options={personOptions}
                  placeholder={`Select ${pluralLabel}`}
                  selectedIds={selectedPersonIds}
                  selectAllLabel={`Select all ${pluralLabel}`}
                  onChange={(nextIds) => {
                    setSelectedGroupId("");
                    setSelectedPersonIds(nextIds);
                  }}
                />
              </div>
              {audience === "member" ? (
                <label className="attendance-group-filter">
                  {groupLabel}
                  <select value={selectedGroupId} onChange={(event) => handleGroupSelection(event.target.value)}>
                    <option value="">Select {groupLabel.toLowerCase()}</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="attendance-record-grid">
              <div className="attendance-main-field">
                <label>
                  Notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} />
                </label>
              </div>
              <div className="attendance-side-fields">
                <label>
                  Date
                  <span className="input-with-action">
                    <input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required />
                    <button className="secondary-button" type="button" onClick={() => setAttendanceDate(todayIsoDate())}>
                      Today
                    </button>
                  </span>
                </label>
                <div className="status-field">
                  <span>Status</span>
                  <div className="status-segmented">
                    {(["present", "absent", "late", "excused"] as AttendanceStatus[]).map((option) => (
                      <button className={status === option ? "active" : ""} type="button" key={option} onClick={() => setStatus(option)}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <button className="primary-button fit" type="submit" disabled={isSubmitting || people.length === 0}>
              {isSubmitting ? <Loader2 className="spin" size={18} /> : <ClipboardCheck size={18} />}
              Save attendance
            </button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

function DailyAttendancePage({ audience, token }: { audience: AttendanceAudience; token: string }) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [filterDate, setFilterDate] = useState(todayIsoDate());
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.attendance(token, { audience, fromDate: filterDate, toDate: filterDate }),
      api.currentTenant(token),
      audience === "member" ? api.memberGroups(token) : Promise.resolve({ groups: [] })
    ])
      .then(([attendanceData, tenantData, groupsData]) => {
        setRecords(attendanceData.records);
        setTenant(tenantData.tenant);
        setGroups(groupsData.groups.filter((group) => group.status === "active"));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load attendance"))
      .finally(() => setIsLoading(false));
  }, [audience, filterDate, token]);

  const pluralLabel = audience === "staff" ? tenant?.staffPlural || "staff" : tenant?.memberPlural || "members";
  const filteredRecords = useMemo(() => {
    if (audience !== "member" || !selectedGroupId) return records;
    const group = groups.find((item) => String(item.id) === selectedGroupId);
    if (!group) return [];
    const memberIds = new Set(groupMembers(group).map((member) => Number(member.id)));
    return records.filter((record) => memberIds.has(record.personId));
  }, [audience, groups, records, selectedGroupId]);

  return (
    <div className="page-stack">
      {error ? <Alert message={error} /> : null}
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Records</p>
            <h2>Daily {pluralLabel} attendance</h2>
          </div>
          <div className="panel-header-actions">
            {audience === "member" ? (
              <label className="inline-filter">
                {tenant?.memberGroupSingular || "Class"}
                <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                  <option value="">All {pluralLabel}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="inline-filter attendance-date-filter">
              Date
              <span className="input-with-action">
                <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
                <button className="secondary-button" type="button" onClick={() => setFilterDate(todayIsoDate())}>
                  Today
                </button>
              </span>
            </label>
          </div>
        </div>

        {isLoading ? <div className="loading-state compact"><Loader2 className="spin" size={20} /> Loading attendance</div> : null}
        {!isLoading ? (
          <PaginatedTable
            columns={attendanceColumns()}
            emptyMessage="No attendance records for this date."
            getRowKey={(record) => record.id || `${record.personId}-${record.attendanceDate}`}
            rows={filteredRecords}
          />
        ) : null}
      </section>
    </div>
  );
}

function ProfilePage({ session, onSessionChange }: { session: Session; onSessionChange: (session: Session) => void }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [displayName, setDisplayName] = useState(session.user.displayName);
  const [email, setEmail] = useState(session.user.email);
  const [userIdentifier, setUserIdentifier] = useState(session.user.userIdentifier ?? "");
  const [newUserIdentifier, setNewUserIdentifier] = useState(session.user.newUserIdentifier ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!session.user.clientId) return;
    api
      .currentTenant(session.token)
      .then((tenantData) => setTenant(tenantData.tenant))
      .catch(() => setTenant(null));
  }, [session.token, session.user.clientId]);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSavingProfile(true);

    try {
      const updated = await api.updateProfile(session.token, {
        displayName,
        email,
        userIdentifier: userIdentifier || null,
        newUserIdentifier: newUserIdentifier || null
      });
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
          <div className="form-row">
            <label>
              {tenant?.userIdentifierLabel || "User ID"}
              <input value={userIdentifier} onChange={(event) => setUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
            <label>
              {tenant?.newUserIdentifierLabel || "New User ID"}
              <input value={newUserIdentifier} onChange={(event) => setNewUserIdentifier(normalizeIdentifierInput(event.target.value))} />
            </label>
          </div>
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
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedSystemCode, setSelectedSystemCode] = useState("attendance");
  const [availableSystems, setAvailableSystems] = useState<AvailableSystem[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantFeatures, setTenantFeatures] = useState<TenantFeature[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
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

  useEffect(() => {
    if (session.user.role !== "tenant_admin" && session.user.role !== "tenant_staff") return;
    Promise.all([api.currentTenantFeatures(session.token), api.currentTenant(session.token)])
      .then(([featuresData, tenantData]) => {
        setTenantFeatures(featuresData.features);
        setCurrentTenant(tenantData.tenant);
      })
      .catch(() => {
        setTenantFeatures([]);
        setCurrentTenant(null);
      });
  }, [session.token, session.user.role]);

  useEffect(() => {
    if (session.user.role !== "super_admin") return;
    api
      .systems(session.token)
      .then((data) => {
        setAvailableSystems(data.systems);
        if (data.systems[0]) setSelectedSystemCode((current) => current || data.systems[0].code);
      })
      .catch(() => setAvailableSystems([]));
  }, [session.token, session.user.role]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function navigateTo(nextView: View) {
    if (hasUnsavedChanges && !confirmDiscardChanges()) return;
    setHasUnsavedChanges(false);
    setView(nextView);
  }

  function handleLogoutClick() {
    if (hasUnsavedChanges && !confirmDiscardChanges()) return;
    setHasUnsavedChanges(false);
    onLogout();
  }

  function handleWorkspaceChange(event: FormEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".table-search")) return;
    if (target.closest("form.stack-form")) setHasUnsavedChanges(true);
  }

  function handleWorkspaceSubmitCapture(event: FormEvent<HTMLElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest("form.stack-form")) return;
    if (!confirmSaveChanges()) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setHasUnsavedChanges(false);
  }

  const hasStaffAttendance = tenantFeatures.some((feature) => feature.code === "attendance_staff" && Boolean(feature.enabled));
  const hasMemberAttendance = tenantFeatures.some((feature) => feature.code === "attendance_member" && Boolean(feature.enabled));
  const defaultAttendanceView: View | null = hasMemberAttendance
    ? "attendance-member-record"
    : hasStaffAttendance
      ? "attendance-staff-record"
      : null;
  const defaultDailyAttendanceView: View | null = hasMemberAttendance
    ? "attendance-member-daily"
    : hasStaffAttendance
      ? "attendance-staff-daily"
      : null;
  const attendanceItems = [
    ...(hasStaffAttendance
      ? [
          {
            active: view === "attendance-staff-record",
            icon: <ClipboardCheck size={18} />,
            label: "Record Staff",
            onClick: () => navigateTo("attendance-staff-record")
          },
          {
            active: view === "attendance-staff-daily",
            icon: <CalendarDays size={18} />,
            label: "Daily Staff",
            onClick: () => navigateTo("attendance-staff-daily")
          }
        ]
      : []),
    ...(hasMemberAttendance
      ? [
          {
            active: view === "attendance-member-record",
            icon: <ClipboardCheck size={18} />,
            label: "Record Members",
            onClick: () => navigateTo("attendance-member-record")
          },
          {
            active: view === "attendance-member-daily",
            icon: <CalendarDays size={18} />,
            label: "Daily Members",
            onClick: () => navigateTo("attendance-member-daily")
          }
        ]
      : [])
  ];

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
          <button className={view === "dashboard" ? "active" : ""} type="button" onClick={() => navigateTo("dashboard")}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          {session.user.role === "super_admin" ? (
            <>
              <SidebarGroup
                icon={<Building2 size={18} />}
                isActive={view === "tenant-register" || view === "tenant-manage"}
                label="Tenants"
                items={[
                  {
                    active: view === "tenant-register",
                    icon: <Plus size={18} />,
                    label: "Tenant Register",
                    onClick: () => navigateTo("tenant-register")
                  },
                  {
                    active: view === "tenant-manage",
                    icon: <Building2 size={18} />,
                    label: "Manage Tenants",
                    onClick: () => navigateTo("tenant-manage")
                  }
                ]}
              />
              <SidebarGroup
                icon={<Settings size={18} />}
                isActive={view === "system-dashboard" || view === "system-settings" || view === "system-tenant-settings"}
                label="Available Systems"
                items={availableSystems.map((system) => ({
                  active:
                    selectedSystemCode === system.code &&
                    (view === "system-dashboard" || view === "system-settings" || view === "system-tenant-settings"),
                  icon: <Settings size={18} />,
                  label: system.name,
                  onClick: () => {
                    setSelectedSystemCode(system.code);
                    navigateTo("system-dashboard");
                  }
                }))}
              />
            </>
          ) : null}
          {session.user.role === "tenant_admin" || session.user.role === "tenant_staff" ? (
            <>
              <SidebarGroup
                icon={<UsersRound size={18} />}
                isActive={
                  view === "user-register" ||
                  view === "user-manage" ||
                  view === "user-detail" ||
                  view === "member-group-create" ||
                  view === "member-group-manage" ||
                  view === "member-group-detail"
                }
                label="Users"
                items={[
                  {
                    active: view === "user-register",
                    icon: <Plus size={18} />,
                    label: "User Register",
                    onClick: () => navigateTo("user-register")
                  },
                  {
                    active: view === "user-manage" || view === "user-detail",
                    icon: <UsersRound size={18} />,
                    label: "Manage Users",
                    onClick: () => navigateTo("user-manage")
                  },
                  {
                    active: view === "member-group-manage" || view === "member-group-create" || view === "member-group-detail",
                    icon: <FolderPlus size={18} />,
                    label: `Manage ${currentTenant?.memberGroupPlural || "Classes"}`,
                    onClick: () => navigateTo("member-group-manage")
                  }
                ]}
              />
              {attendanceItems.length > 0 ? (
                <SidebarGroup
                  icon={<ClipboardCheck size={18} />}
                  isActive={
                    view === "attendance-staff-record" ||
                    view === "attendance-staff-daily" ||
                    view === "attendance-member-record" ||
                    view === "attendance-member-daily"
                  }
                  label="Attendance"
                  items={attendanceItems}
                />
              ) : null}
            </>
          ) : null}
          <button className={view === "profile" ? "active" : ""} type="button" onClick={() => navigateTo("profile")}>
            <UserCog size={18} />
            Profile
          </button>
        </nav>
      </aside>

      <section className="workspace" onChangeCapture={handleWorkspaceChange} onSubmitCapture={handleWorkspaceSubmitCapture}>
        <header className="topbar">
          <div>
            <p className="eyebrow">{roleLabel(session.user.role)}</p>
            <h1>{pageTitleFor(view)}</h1>
          </div>
          <div className="user-menu">
            <div className="avatar" aria-hidden="true">
              <UserRound size={18} />
            </div>
            <div>
              <strong>{session.user.displayName}</strong>
              <span>{session.user.email}</span>
            </div>
            <button className="icon-button" type="button" onClick={handleLogoutClick} aria-label="Sign out" title="Sign out">
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
          <SystemDashboard dashboard={dashboard} onOpenTenants={() => navigateTo("tenant-manage")} />
        ) : null}
        {view === "dashboard" && !isLoading && dashboard && session.user.role === "tenant_admin" ? (
          <TenantAdminDashboard
            dashboard={dashboard}
            onOpenUsers={() => navigateTo("user-manage")}
            onCreateUser={() => navigateTo("user-register")}
            onOpenAttendance={defaultAttendanceView ? () => navigateTo(defaultAttendanceView) : null}
          />
        ) : null}
        {view === "dashboard" && !isLoading && dashboard && session.user.role === "tenant_staff" ? (
          <StaffDashboard
            dashboard={dashboard}
            onMarkAttendance={defaultAttendanceView ? () => navigateTo(defaultAttendanceView) : null}
            onOpenDailyAttendance={defaultDailyAttendanceView ? () => navigateTo(defaultDailyAttendanceView) : null}
          />
        ) : null}
        {view === "dashboard" && !isLoading && session.user.role === "tenant_member" ? <MemberDashboard user={session.user} /> : null}
        {view === "tenant-register" && session.user.role === "super_admin" ? <TenantRegister token={session.token} /> : null}
        {view === "tenant-manage" && session.user.role === "super_admin" ? <ManageTenants token={session.token} /> : null}
        {view === "system-dashboard" && session.user.role === "super_admin" ? (
          <SystemDashboardPage
            systemCode={selectedSystemCode}
            token={session.token}
            onOpenSystemSettings={() => navigateTo("system-settings")}
            onOpenTenantSettings={() => navigateTo("system-tenant-settings")}
          />
        ) : null}
        {view === "system-settings" && session.user.role === "super_admin" ? <SystemSettingsPage systemCode={selectedSystemCode} token={session.token} /> : null}
        {view === "system-tenant-settings" && session.user.role === "super_admin" ? (
          <TenantSystemSettingsPage systemCode={selectedSystemCode} token={session.token} />
        ) : null}
        {view === "user-register" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <UserRegister token={session.token} actorRole={session.user.role} />
        ) : null}
        {view === "user-manage" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <ManageUsers
            token={session.token}
            onOpenUser={(userId) => {
              setSelectedUserId(userId);
              navigateTo("user-detail");
            }}
          />
        ) : null}
        {view === "user-detail" && selectedUserId && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <UserDetailsPage token={session.token} actorRole={session.user.role} userId={selectedUserId} onBack={() => navigateTo("user-manage")} />
        ) : null}
        {view === "member-group-manage" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <ManageMemberGroups
            token={session.token}
            onCreateGroup={() => navigateTo("member-group-create")}
            onOpenGroup={(groupId) => {
              setSelectedUserId(groupId);
              navigateTo("member-group-detail");
            }}
          />
        ) : null}
        {view === "member-group-create" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <MemberGroupDetailsPage token={session.token} onBack={() => navigateTo("member-group-manage")} />
        ) : null}
        {view === "member-group-detail" && selectedUserId && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <MemberGroupDetailsPage token={session.token} groupId={selectedUserId} onBack={() => navigateTo("member-group-manage")} />
        ) : null}
        {view === "attendance-staff-record" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <RecordAttendancePage audience="staff" token={session.token} />
        ) : null}
        {view === "attendance-staff-daily" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <DailyAttendancePage audience="staff" token={session.token} />
        ) : null}
        {view === "attendance-member-record" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <RecordAttendancePage audience="member" token={session.token} />
        ) : null}
        {view === "attendance-member-daily" && (session.user.role === "tenant_admin" || session.user.role === "tenant_staff") ? (
          <DailyAttendancePage audience="member" token={session.token} />
        ) : null}
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
