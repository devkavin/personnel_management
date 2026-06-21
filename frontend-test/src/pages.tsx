import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Chip, Input, Modal, Tabs, TextArea } from "@heroui/react";
import { CalendarCheck, Pencil, RefreshCw, X } from "lucide-react";
import { api, type AttendanceAudience, type AttendanceRecord, type AttendanceStatus, type AuthUser, type AvailableSystem, type DashboardResponse, type MemberGroup, type Person, type Role, type SystemDashboardResponse, type SystemSetting, type Tenant, type TenantFeature, type TenantSystemSetting } from "./api";
import { ConfirmAction, DataTable, LoadingState, Notice, PageHeader, SearchableMultiSelect, SearchableSelect } from "./components";

const roleOptions = [
  { value: "tenant_admin", label: "Tenant admin" },
  { value: "tenant_staff", label: "Staff" },
  { value: "tenant_member", label: "Member" }
];
const statusOptions = ["present", "absent", "late", "excused"].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const boolValue = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";
const today = () => new Date().toISOString().slice(0, 10);
const messageOf = (error: unknown) => error instanceof Error ? error.message : "Request failed";
function memberIds(group: MemberGroup) {
  if (Array.isArray(group.members)) return group.members.filter((member): member is { id: number; displayName: string } => Boolean(member?.id)).map((member) => Number(member.id));
  if (!group.members) return [];
  try { return (JSON.parse(group.members) as Array<{ id: number } | null>).filter((member): member is { id: number } => Boolean(member?.id)).map((member) => Number(member.id)); } catch { return []; }
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="field-stack"><span className="field-label">{label}{required ? " *" : ""}</span><Input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} /></label>;
}

const tenantDefaults = {
  name: "", slug: "", personSingular: "person", personPlural: "people", staffSingular: "staff", staffPlural: "staff",
  memberSingular: "member", memberPlural: "members", userIdentifierLabel: "User ID", newUserIdentifierLabel: "New User ID",
  memberGroupSingular: "Class", memberGroupPlural: "Classes"
};

export function TenantsPage({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tab, setTab] = useState("manage");
  const [form, setForm] = useState(tenantDefaults);
  const [admin, setAdmin] = useState({ displayName: "", email: "", userIdentifier: "", password: "" });
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [featureFlags, setFeatureFlags] = useState<TenantFeature[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setLoading(true); try { setTenants((await api.tenants(token)).tenants); setError(""); } catch (err) { setError(messageOf(err)); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function createTenant() {
    await api.createTenant(token, { ...form, admin: admin.displayName ? { ...admin } : undefined });
    setForm(tenantDefaults); setAdmin({ displayName: "", email: "", userIdentifier: "", password: "" }); setNotice("Tenant created successfully");
    await load(); onChanged(); setTab("manage");
  }

  async function updateTenant() {
    if (!editing) return;
    await Promise.all([
      api.updateTenant(token, editing.id, editing),
      api.updateTenantFeatures(token, editing.id, Object.fromEntries(featureFlags.map((feature) => [feature.code, boolValue(feature.enabled)])))
    ]);
    setNotice("Tenant settings updated"); setEditing(null); await load(); onChanged();
  }

  return <div className="page-stack">
    <PageHeader eyebrow="Super admin" title="Tenants" description="Create organizations and manage their terminology, identifiers, and lifecycle." actions={<Button variant="outline" onPress={() => void load()}><RefreshCw size={16} />Refresh</Button>} />
    {notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}
    <Tabs className="module-tabs" selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} aria-label="Tenant pages">
      <Tabs.ListContainer>
        <Tabs.List aria-label="Tenant pages">
          <Tabs.Tab id="manage">Manage tenants<Tabs.Indicator /></Tabs.Tab>
          <Tabs.Tab id="register">Register tenant<Tabs.Indicator /></Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="manage">
        {loading ? <LoadingState /> : <DataTable rows={tenants} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.slug} ${row.status}`} columns={[
          { header: "Tenant", render: (row) => <div className="primary-cell"><strong>{row.name}</strong><span>{row.slug}</span></div> },
          { header: "Terminology", render: (row) => <span>{row.staffPlural} / {row.memberPlural}</span> },
          { header: "Status", render: (row) => <Chip color={row.status === "active" ? "success" : "warning"} variant="soft">{row.status}</Chip> },
          { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={async () => { setEditing({ ...row }); setFeatureFlags((await api.tenantFeatures(token, row.id)).features); }}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title="Deactivate tenant?" description={`Users in ${row.name} will lose access.`} onConfirm={async () => { await api.deactivateTenant(token, row.id); await load(); onChanged(); }} /></div> }
        ]} />}
        {editing ? <Card className="form-card"><Card.Header><h3>Edit {editing.name}</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} required /><Field label="Slug" value={editing.slug} onChange={(slug) => setEditing({ ...editing, slug })} required /><Field label="Staff singular" value={editing.staffSingular} onChange={(staffSingular) => setEditing({ ...editing, staffSingular })} /><Field label="Staff plural" value={editing.staffPlural} onChange={(staffPlural) => setEditing({ ...editing, staffPlural })} /><Field label="Member singular" value={editing.memberSingular} onChange={(memberSingular) => setEditing({ ...editing, memberSingular })} /><Field label="Member plural" value={editing.memberPlural} onChange={(memberPlural) => setEditing({ ...editing, memberPlural })} /><Field label="Identifier label" value={editing.userIdentifierLabel} onChange={(userIdentifierLabel) => setEditing({ ...editing, userIdentifierLabel })} /><Field label="Group singular" value={editing.memberGroupSingular} onChange={(memberGroupSingular) => setEditing({ ...editing, memberGroupSingular })} />{featureFlags.map((feature) => <Checkbox key={feature.code} isSelected={boolValue(feature.enabled)} onChange={(enabled) => setFeatureFlags((items) => items.map((item) => item.code === feature.code ? { ...item, enabled } : item))}>{feature.name}</Checkbox>)}</div><div className="form-actions"><Button variant="ghost" onPress={() => setEditing(null)}><X size={16} />Discard</Button><ConfirmAction label="Save changes" title="Save tenant changes?" description="These settings affect terminology and feature access throughout this tenant." onConfirm={updateTenant} /></div></Card.Content></Card> : null}
      </Tabs.Panel>
      <Tabs.Panel id="register"><Card className="form-card"><Card.Header><h3>Tenant details</h3></Card.Header><Card.Content><div className="form-grid">{Object.entries(form).map(([key, value]) => <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())} value={value} required={["name", "slug"].includes(key)} onChange={(next) => setForm({ ...form, [key]: next })} />)}</div><h3>Initial tenant admin</h3><div className="form-grid"><Field label="Display name" value={admin.displayName} onChange={(displayName) => setAdmin({ ...admin, displayName })} /><Field label="Email" type="email" value={admin.email} onChange={(email) => setAdmin({ ...admin, email })} /><Field label="User ID" value={admin.userIdentifier} onChange={(userIdentifier) => setAdmin({ ...admin, userIdentifier })} /><Field label="Temporary password" type="password" value={admin.password} onChange={(password) => setAdmin({ ...admin, password })} /></div><div className="form-actions"><ConfirmAction label="Create tenant" title="Create this tenant?" description="The tenant and optional initial administrator will be created immediately." disabled={!form.name || !form.slug} onConfirm={createTenant} /></div></Card.Content></Card></Tabs.Panel>
    </Tabs>
  </div>;
}

export function SystemsPage({ token }: { token: string }) {
  const [systems, setSystems] = useState<AvailableSystem[]>([]);
  const [selected, setSelected] = useState("");
  const [dashboard, setDashboard] = useState<SystemDashboardResponse | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSystemSetting[]>([]);
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");

  useEffect(() => { api.systems(token).then((data) => { setSystems(data.systems); setSelected((value) => value || data.systems[0]?.code || ""); }).catch((err) => setError(messageOf(err))); }, [token]);
  useEffect(() => { if (!selected) return; Promise.all([api.systemDashboard(token, selected), api.systemSettings(token, selected), api.systemTenantSettings(token, selected)]).then(([dash, config, tenants]) => { setDashboard(dash); setSettings(config.settings); setTenantSettings(tenants.tenantSettings); setError(""); }).catch((err) => setError(messageOf(err))); }, [selected, token]);
  const system = systems.find((item) => item.code === selected);
  const setting = (key: string) => settings.find((item) => item.key === key)?.value;

  async function saveSystem() {
    if (!system) return;
    await api.updateSystemSettings(token, selected, { name: system.name, description: system.description, status: system.status, settings: { defaultAttendanceStatus: setting("default_attendance_status") as AttendanceStatus | undefined, notesEnabled: setting("notes_enabled") === "true" } });
    setNotice("System settings saved");
  }

  return <div className="page-stack"><PageHeader eyebrow="Super admin" title="Available systems" description="Inspect system adoption and configure global and tenant-level behavior." />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}
    <SearchableSelect label="System" value={selected} onChange={setSelected} options={systems.map((item) => ({ value: item.code, label: item.name, meta: item.status }))} />
    {dashboard ? <div className="metric-row"><Metric label="Tenants" value={dashboard.stats.totalTenants} /><Metric label="Enabled" value={dashboard.stats.enabledTenants} /><Metric label="Staff attendance" value={dashboard.stats.staffAttendanceTenants} /><Metric label="Member attendance" value={dashboard.stats.memberAttendanceTenants} /></div> : <LoadingState />}
    {system ? <Card className="form-card"><Card.Header><h3>System settings</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={system.name} onChange={(name) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, name } : item))} /><label className="field-stack"><span className="field-label">Description</span><TextArea value={system.description ?? ""} onChange={(event) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, description: event.target.value } : item))} /></label><SearchableSelect label="Status" value={system.status} onChange={(status) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, status: status as "active" | "inactive" } : item))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />{settings.map((item) => item.type === "boolean" ? <Checkbox key={item.key} isSelected={item.value === "true"} onChange={(checked) => setSettings((items) => items.map((entry) => entry.key === item.key ? { ...entry, value: checked ? "true" : "false" } : entry))}>{item.name}</Checkbox> : <SearchableSelect key={item.key} label={item.name} value={item.value} onChange={(value) => setSettings((items) => items.map((entry) => entry.key === item.key ? { ...entry, value } : entry))} options={(item.options ?? []).map((value) => ({ value, label: value }))} />)}</div><div className="form-actions"><ConfirmAction label="Save settings" title="Save system settings?" description="These global defaults affect tenants using this system." onConfirm={saveSystem} /></div></Card.Content></Card> : null}
    <DataTable rows={tenantSettings} rowKey={(row) => row.tenantId} searchText={(row) => `${row.tenantName} ${row.tenantSlug}`} columns={[
      { header: "Tenant", render: (row) => <div className="primary-cell"><strong>{row.tenantName}</strong><span>{row.tenantSlug}</span></div> },
      { header: "System", render: (row) => <Chip color={boolValue(row.enabled) ? "success" : "warning"} variant="soft">{boolValue(row.enabled) ? "Enabled" : "Disabled"}</Chip> },
      { header: "Attendance", render: (row) => <div className="row-actions"><Checkbox isSelected={boolValue(row.staffAttendanceEnabled)} onChange={(staffAttendanceEnabled) => setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? { ...item, staffAttendanceEnabled } : item))}>Staff</Checkbox><Checkbox isSelected={boolValue(row.memberAttendanceEnabled)} onChange={(memberAttendanceEnabled) => setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? { ...item, memberAttendanceEnabled } : item))}>Member</Checkbox></div> },
      { header: "Actions", render: (row) => <div className="row-actions"><ConfirmAction label="Save" title="Save tenant settings?" description={`This changes ${system?.name ?? "the system"} for ${row.tenantName}.`} onConfirm={async () => { await api.updateSystemTenantSettings(token, selected, row.tenantId, { enabled: boolValue(row.enabled), settings: { staffAttendanceEnabled: boolValue(row.staffAttendanceEnabled), memberAttendanceEnabled: boolValue(row.memberAttendanceEnabled) } }); setNotice(`${row.tenantName} settings saved`); }} /><ConfirmAction variant={boolValue(row.enabled) ? "danger-soft" : "secondary"} label={boolValue(row.enabled) ? "Disable" : "Enable"} title="Update tenant system?" description={`This changes ${system?.name ?? "the system"} for ${row.tenantName}.`} onConfirm={async () => { const enabled = !boolValue(row.enabled); await api.updateSystemTenantSettings(token, selected, row.tenantId, { enabled, settings: { staffAttendanceEnabled: boolValue(row.staffAttendanceEnabled), memberAttendanceEnabled: boolValue(row.memberAttendanceEnabled) } }); setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? { ...item, enabled } : item)); }} /></div> }
    ]} />
  </div>;
}

function Metric({ label, value }: { label: string; value: unknown }) { return <Card className="stat-card"><Card.Content><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></Card.Content></Card>; }

export function PeoplePage({ token, tenant, role, onChanged }: { token: string; tenant: Tenant; role: Role; onChanged: () => void }) {
  const [people, setPeople] = useState<Person[]>([]); const [groups, setGroups] = useState<MemberGroup[]>([]); const [tab, setTab] = useState("manage");
  const [editing, setEditing] = useState<Person | null>(null); const [originalUser, setOriginalUser] = useState<Person | null>(null); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const [discardUserOpen, setDiscardUserOpen] = useState(false);
  const [single, setSingle] = useState({ userIdentifier: "", role: role === "tenant_staff" ? "tenant_member" : "tenant_member", memberGroupId: "" });
  const [full, setFull] = useState({ displayName: "", email: "", userIdentifier: "", newUserIdentifier: "", password: "", role: role === "tenant_staff" ? "tenant_member" : "tenant_member" });
  const [bulk, setBulk] = useState(""); const [group, setGroup] = useState<{ name: string; description: string; memberIds?: number[] }>({ name: "", description: "" }); const [editingGroup, setEditingGroup] = useState<MemberGroup | null>(null); const [originalGroup, setOriginalGroup] = useState<MemberGroup | null>(null); const [discardGroupOpen, setDiscardGroupOpen] = useState(false);
  const allowedRoles = role === "tenant_staff" ? roleOptions.filter((item) => item.value === "tenant_member") : roleOptions;
  const memberOptions = useMemo(() => people.filter((person) => person.role === "tenant_member").map((person) => {
    const classNames = groups.filter((item) => memberIds(item).includes(person.id)).map((item) => item.name);
    const membership = classNames.length > 0 ? `${tenant.memberGroupPlural}: ${classNames.join(", ")}` : `No ${tenant.memberGroupSingular.toLowerCase()}`;
    return { value: String(person.id), label: person.displayName, meta: [person.userIdentifier, membership].filter(Boolean).join(" | ") };
  }), [groups, people, tenant.memberGroupPlural, tenant.memberGroupSingular]);
  const groupNamesForPerson = (personId: number) => groups.filter((item) => memberIds(item).includes(personId)).map((item) => item.name);
  const load = useCallback(async () => { try { const [users, classes] = await Promise.all([api.people(token), api.memberGroups(token)]); setPeople(users.people); setGroups(classes.groups); setError(""); } catch (err) { setError(messageOf(err)); } }, [token]);
  useEffect(() => { void load(); }, [load]);

  const userHasChanges = Boolean(editing && originalUser && ["displayName", "email", "userIdentifier", "newUserIdentifier", "role", "status"].some((field) => editing[field as keyof Person] !== originalUser[field as keyof Person]));
  function closeUserEditor() {
    if (userHasChanges) {
      setDiscardUserOpen(true);
      return;
    }
    setEditing(null);
    setOriginalUser(null);
  }

  const userEditor = editing ? (
    <Modal isOpen onOpenChange={(isOpen) => { if (!isOpen) closeUserEditor(); }}>
      <Modal.Backdrop className="user-editor-backdrop" isDismissable>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="user-editor-dialog">
            {discardUserOpen ? <>
              <Modal.Header><Modal.Heading>Discard user changes?</Modal.Heading></Modal.Header>
              <Modal.Body><p>Your unsaved changes to {editing.displayName} will be lost.</p></Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDiscardUserOpen(false)}>Continue editing</Button>
                <Button variant="danger" onPress={() => { setDiscardUserOpen(false); setEditing(null); setOriginalUser(null); }}><X size={16} />Discard changes</Button>
              </Modal.Footer>
            </> : <>
              <Modal.Header><Modal.Heading>Edit {editing.displayName}</Modal.Heading><Modal.CloseTrigger aria-label="Close editor" /></Modal.Header>
              <Modal.Body><div className="form-grid"><Field label="Display name" value={editing.displayName} onChange={(displayName) => setEditing({ ...editing, displayName })} /><Field label="Email" type="email" value={editing.email ?? ""} onChange={(email) => setEditing({ ...editing, email })} /><Field label={tenant.userIdentifierLabel} value={editing.userIdentifier ?? ""} onChange={(userIdentifier) => setEditing({ ...editing, userIdentifier })} /><Field label={tenant.newUserIdentifierLabel} value={editing.newUserIdentifier ?? ""} onChange={(newUserIdentifier) => setEditing({ ...editing, newUserIdentifier })} /><SearchableSelect label="Role" value={editing.role} onChange={(nextRole) => setEditing({ ...editing, role: nextRole as Person["role"] })} options={allowedRoles} /><SearchableSelect label="Status" value={editing.status} onChange={(status) => setEditing({ ...editing, status: status as Person["status"] })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></div></Modal.Body>
              <Modal.Footer className="user-editor-actions"><Button variant="ghost" onPress={closeUserEditor}><X size={16} />Discard</Button><ConfirmAction label="Save user" title="Save user changes?" description="The user profile and permissions will be updated." disabled={!userHasChanges} onConfirm={async () => { await api.updatePerson(token, editing.id, { displayName: editing.displayName, email: editing.email || undefined, userIdentifier: editing.userIdentifier, newUserIdentifier: editing.newUserIdentifier, role: editing.role, status: editing.status }); setEditing(null); setOriginalUser(null); setNotice("User updated"); await load(); onChanged(); }} /></Modal.Footer>
            </>}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ) : null;

  const groupHasChanges = Boolean(editingGroup && originalGroup && (
    editingGroup.name !== originalGroup.name ||
    editingGroup.description !== originalGroup.description ||
    editingGroup.status !== originalGroup.status ||
    JSON.stringify(memberIds(editingGroup).sort((a, b) => a - b)) !== JSON.stringify(memberIds(originalGroup).sort((a, b) => a - b))
  ));

  function closeGroupEditor() {
    if (groupHasChanges) {
      setDiscardGroupOpen(true);
      return;
    }
    setEditingGroup(null);
    setOriginalGroup(null);
  }

  function openGroupEditor(groupToEdit: MemberGroup) {
    const selected = new Set(memberIds(groupToEdit));
    const normalized = {
      ...groupToEdit,
      members: people.filter((person) => selected.has(person.id)).map((person) => ({ id: person.id, displayName: person.displayName }))
    };
    setDiscardGroupOpen(false);
    setOriginalGroup({ ...normalized, members: [...normalized.members] });
    setEditingGroup({ ...normalized, members: [...normalized.members] });
  }

  const groupEditor = editingGroup ? (
    <Modal isOpen onOpenChange={(isOpen) => { if (!isOpen) closeGroupEditor(); }}>
      <Modal.Backdrop className="user-editor-backdrop" isDismissable>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog className="user-editor-dialog">
            {discardGroupOpen ? <>
              <Modal.Header><Modal.Heading>Discard {tenant.memberGroupSingular.toLowerCase()} changes?</Modal.Heading></Modal.Header>
              <Modal.Body><p>Your unsaved changes to {editingGroup.name} will be lost.</p></Modal.Body>
              <Modal.Footer>
                <Button variant="ghost" onPress={() => setDiscardGroupOpen(false)}>Continue editing</Button>
                <Button variant="danger" onPress={() => { setDiscardGroupOpen(false); setEditingGroup(null); setOriginalGroup(null); }}><X size={16} />Discard changes</Button>
              </Modal.Footer>
            </> : <>
              <Modal.Header><Modal.Heading>Edit {editingGroup.name}</Modal.Heading><Modal.CloseTrigger aria-label="Close editor" /></Modal.Header>
              <Modal.Body className="group-editor-body">
                <div className="form-grid">
                  <Field label="Name" value={editingGroup.name} onChange={(name) => setEditingGroup({ ...editingGroup, name })} required />
                  <SearchableSelect label="Status" value={editingGroup.status} onChange={(status) => setEditingGroup({ ...editingGroup, status: status as MemberGroup["status"] })} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
                </div>
                <label className="field-stack"><span className="field-label">Description</span><TextArea rows={4} value={editingGroup.description ?? ""} onChange={(event) => setEditingGroup({ ...editingGroup, description: event.target.value })} /></label>
                <div className="member-manager">
                  <div><strong>Members</strong><span>{memberIds(editingGroup).length} selected</span></div>
                  <SearchableMultiSelect label={`Add or remove ${tenant.memberPlural}`} values={memberIds(editingGroup).map(String)} options={memberOptions} onChange={(values) => { const selected = new Set(values.map(Number)); setEditingGroup({ ...editingGroup, members: people.filter((person) => selected.has(person.id)).map((person) => ({ id: person.id, displayName: person.displayName })), memberCount: selected.size }); }} />
                </div>
              </Modal.Body>
              <Modal.Footer className="user-editor-actions"><Button variant="ghost" onPress={closeGroupEditor}><X size={16} />Discard</Button><ConfirmAction label={`Save ${tenant.memberGroupSingular.toLowerCase()}`} title={`Save ${tenant.memberGroupSingular.toLowerCase()} changes?`} description="The details and member assignments will be updated." disabled={!groupHasChanges} onConfirm={async () => { await api.updateMemberGroup(token, editingGroup.id, { name: editingGroup.name, description: editingGroup.description, status: editingGroup.status, memberIds: memberIds(editingGroup) }); setEditingGroup(null); setOriginalGroup(null); setNotice(`${tenant.memberGroupSingular} updated`); await load(); }} /></Modal.Footer>
            </>}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  ) : null;

  return <div className="page-stack"><PageHeader eyebrow={tenant.name} title="People" description={`Manage ${tenant.staffPlural}, ${tenant.memberPlural}, and ${tenant.memberGroupPlural}.`} actions={<Button variant="outline" onPress={() => void load()}><RefreshCw size={16} />Refresh</Button>} />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}
    <Tabs className="module-tabs" selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} aria-label="People pages"><Tabs.ListContainer><Tabs.List aria-label="People pages"><Tabs.Tab id="manage">Manage users<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="onboard">Onboard users<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="groups">{tenant.memberGroupPlural}<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer>
      <Tabs.Panel id="manage">{userEditor}<DataTable rows={people} rowKey={(row) => row.id} searchText={(row) => `${row.displayName} ${row.email} ${row.userIdentifier} ${row.role} ${row.status} ${groupNamesForPerson(row.id).join(" ")}`} columns={[
        { header: tenant.userIdentifierLabel, render: (row) => <strong>{row.newUserIdentifier || row.userIdentifier || "—"}</strong> },
        { header: "Name", render: (row) => <div className="primary-cell"><strong>{row.displayName}</strong><span>{row.email || "Onboarding pending"}</span></div> },
        { header: "Role", render: (row) => <Chip variant="soft">{row.role.replace("tenant_", "")}</Chip> },
        { header: tenant.memberGroupPlural, render: (row) => { const memberships = groupNamesForPerson(row.id); return memberships.length > 0 ? <div className="membership-list">{memberships.map((name) => <Chip key={name} size="sm" variant="soft">{name}</Chip>)}</div> : <span className="membership-empty">No {tenant.memberGroupSingular.toLowerCase()}</span>; } },
        { header: "Status", render: (row) => <Chip color={row.requiresOnboarding ? "warning" : row.status === "active" ? "success" : "danger"} variant="soft">{row.requiresOnboarding ? "Pending setup" : row.status}</Chip> },
        { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={() => { setOriginalUser({ ...row }); setEditing({ ...row }); }}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title="Deactivate user?" description={`${row.displayName} will no longer be able to sign in.`} onConfirm={async () => { await api.deactivatePerson(token, row.id); await load(); onChanged(); }} /></div> }
      ]} /></Tabs.Panel>
      <Tabs.Panel id="onboard"><div className="split-panels"><Card className="form-card"><Card.Header><h3>Single onboarding</h3></Card.Header><Card.Content><Field label={tenant.userIdentifierLabel} value={single.userIdentifier} onChange={(userIdentifier) => setSingle({ ...single, userIdentifier })} required /><SearchableSelect label="Role" value={single.role} onChange={(nextRole) => setSingle({ ...single, role: nextRole })} options={allowedRoles} /><SearchableSelect label={tenant.memberGroupSingular} value={single.memberGroupId} onChange={(memberGroupId) => setSingle({ ...single, memberGroupId })} options={groups.map((item) => ({ value: String(item.id), label: item.name }))} /><ConfirmAction label="Onboard user" title="Create onboarding account?" description="The user will complete their profile at first login." disabled={!single.userIdentifier} onConfirm={async () => { await api.onboardPerson(token, { userIdentifier: single.userIdentifier, role: single.role as Person["role"], memberGroupId: single.memberGroupId ? Number(single.memberGroupId) : undefined }); setSingle({ ...single, userIdentifier: "" }); setNotice("User onboarded"); await load(); onChanged(); }} /></Card.Content></Card><Card className="form-card"><Card.Header><h3>Bulk onboarding</h3></Card.Header><Card.Content><label className="field-stack"><span className="field-label">{tenant.userIdentifierLabel}s (up to 1000)</span><TextArea rows={10} value={bulk} onChange={(event) => setBulk(event.target.value)} placeholder="One identifier per line, seperated by a comma (,) a space or on a new line." /></label><ConfirmAction label="Bulk onboard" title="Create these accounts?" description="Valid unique identifiers will receive first-login accounts." disabled={!bulk.trim()} onConfirm={async () => { const result = await api.bulkOnboardPeople(token, { userIdentifiers: bulk, role: single.role as Person["role"], memberGroupId: single.memberGroupId ? Number(single.memberGroupId) : undefined }); setBulk(""); setNotice(`${result.created} created, ${result.skipped} skipped`); await load(); onChanged(); }} /></Card.Content></Card><Card className="form-card full-span"><Card.Header><h3>Create complete account</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Display name" value={full.displayName} onChange={(displayName) => setFull({ ...full, displayName })} /><Field label={tenant.userIdentifierLabel} value={full.userIdentifier} onChange={(userIdentifier) => setFull({ ...full, userIdentifier })} /><Field label="Email" type="email" value={full.email} onChange={(email) => setFull({ ...full, email })} /><Field label="Password" type="password" value={full.password} onChange={(password) => setFull({ ...full, password })} /><SearchableSelect label="Role" value={full.role} onChange={(nextRole) => setFull({ ...full, role: nextRole })} options={allowedRoles} /></div><ConfirmAction label="Create account" title="Create complete user account?" description="This user can sign in immediately with the supplied credentials." disabled={!full.displayName || !full.email || full.password.length < 8} onConfirm={async () => { await api.createPerson(token, { ...full, role: full.role as Person["role"] }); setFull({ displayName: "", email: "", userIdentifier: "", newUserIdentifier: "", password: "", role: full.role }); setNotice("User account created"); await load(); onChanged(); }} /></Card.Content></Card></div></Tabs.Panel>
<Tabs.Panel id="groups"><Card className="form-card"><Card.Header><h3>Create {tenant.memberGroupSingular}</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={group.name} onChange={(name) => setGroup({ ...group, name })} /><Field label="Description" value={group.description} onChange={(description) => setGroup({ ...group, description })} /></div><ConfirmAction label={`Create ${tenant.memberGroupSingular}`} title={`Create ${tenant.memberGroupSingular}?`} description="The group will be available for member filtering." disabled={!group.name} onConfirm={async () => { await api.createMemberGroup(token, { ...group, memberIds: [] }); setGroup({ name: "", description: "" }); setNotice(`${tenant.memberGroupSingular} created`); await load(); }} /></Card.Content></Card><DataTable rows={groups} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.description} ${row.status}`} columns={[{ header: "Name", render: (row) => <div className="primary-cell"><strong>{row.name}</strong><span>{row.description || "No description"}</span></div> }, { header: "Members", render: (row) => row.memberCount }, { header: "Status", render: (row) => <Chip variant="soft">{row.status}</Chip> }, { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={() => openGroupEditor(row)}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title={`Deactivate ${row.name}?`} description="The group will no longer be available for selection." onConfirm={async () => { await api.deactivateMemberGroup(token, row.id); await load(); }} /></div> }]} />{groupEditor}</Tabs.Panel>
    </Tabs>
  </div>;
}

export function AttendancePage({ token, tenant, features, onChanged }: { token: string; tenant: Tenant; features: Array<{ code: string; enabled: boolean | number }>; onChanged: () => void }) {
  const memberEnabled = features.some((item) => item.code === "attendance_member" && boolValue(item.enabled));
  const staffEnabled = features.some((item) => item.code === "attendance_staff" && boolValue(item.enabled));
  const initialAudience: AttendanceAudience = memberEnabled ? "member" : "staff";
  const [audience, setAudience] = useState<AttendanceAudience>(initialAudience); const [date, setDate] = useState(today()); const [personIds, setPersonIds] = useState<string[]>([]); const [status, setStatus] = useState<AttendanceStatus>("present"); const [notes, setNotes] = useState("");
  const [people, setPeople] = useState<Person[]>([]); const [records, setRecords] = useState<AttendanceRecord[]>([]); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const audiences = [{ value: "staff", label: tenant.staffPlural }, { value: "member", label: tenant.memberPlural }].filter((item) => item.value === "staff" ? staffEnabled : memberEnabled);
  const eligible = useMemo(() => people.filter((person) => audience === "staff" ? person.role === "tenant_staff" : person.role === "tenant_member"), [audience, people]);
  const attendanceOptions = useMemo(() => eligible.map((person) => {
    const existing = records.find((record) => record.personId === person.id);
    return {
      value: String(person.id),
      label: person.displayName,
      meta: existing ? `Recorded by ${existing.recordedByName}` : person.userIdentifier ?? undefined,
      status: existing?.status,
      disabled: Boolean(existing)
    };
  }).sort((left, right) => Number(left.disabled) - Number(right.disabled) || left.label.localeCompare(right.label)), [eligible, records]);
  const load = useCallback(async () => { try { const [users, attendance] = await Promise.all([api.people(token), api.attendance(token, { audience, fromDate: date, toDate: date })]); setPeople(users.people); setRecords(attendance.records); setError(""); } catch (err) { setError(messageOf(err)); } }, [audience, date, token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPersonIds(attendanceOptions.filter((option) => !option.disabled).map((option) => option.value)); }, [attendanceOptions]);

  return <div className="page-stack"><PageHeader eyebrow={tenant.name} title="Attendance" description="Record and review tenant-scoped attendance using live records." actions={<Button variant="outline" onPress={() => void load()}><RefreshCw size={16} />Refresh</Button>} />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}
    <div className="attendance-layout"><Card className="form-card"><Card.Header><h3>Record attendance</h3></Card.Header><Card.Content><SearchableSelect label="Audience" value={audience} onChange={(value) => setAudience(value as AttendanceAudience)} options={audiences} /><Field label="Date" type="date" value={date} onChange={setDate} /><SearchableMultiSelect label={audience === "staff" ? tenant.staffPlural : tenant.memberPlural} values={personIds} onChange={setPersonIds} options={attendanceOptions} /><SearchableSelect label="Status" value={status} onChange={(value) => setStatus(value as AttendanceStatus)} options={statusOptions} /><label className="field-stack"><span className="field-label">Notes</span><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><ConfirmAction label="Save attendance" title="Save attendance records?" description={`${personIds.length} selected attendance record${personIds.length === 1 ? "" : "s"} will be saved for ${date}.`} disabled={personIds.length === 0} onConfirm={async () => { await Promise.all(personIds.map((personId) => api.createAttendance(token, { personId: Number(personId), audience, attendanceDate: date, status, notes }))); setNotice(`${personIds.length} attendance record${personIds.length === 1 ? "" : "s"} saved`); setNotes(""); await load(); onChanged(); }} /></Card.Content></Card><Card className="summary-card"><Card.Header><h3>{date}</h3></Card.Header><Card.Content><div className="summary-list">{statusOptions.map((item) => <div key={item.value}><span>{item.label}</span><strong>{records.filter((record) => record.status === item.value).length}</strong></div>)}</div></Card.Content></Card></div>
    <DataTable rows={records} rowKey={(row) => row.id} searchText={(row) => `${row.personName} ${row.recordedByName} ${row.status} ${row.notes}`} columns={[{ header: "Person", render: (row) => <strong>{row.personName}</strong> }, { header: "Status", render: (row) => <Chip color={row.status === "present" ? "success" : row.status === "absent" ? "danger" : "warning"} variant="soft">{row.status}</Chip> }, { header: "Recorded by", render: (row) => row.recordedByName }, { header: "Notes", render: (row) => row.notes || "—" }]} />
  </div>;
}

export function ProfilePage({ session, tenant, onSession }: { session: { token: string; user: AuthUser }; tenant: Tenant | null; onSession: (session: { token: string; user: AuthUser }) => void }) {
  const [profile, setProfile] = useState(session.user); const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" }); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { api.profile(session.token).then((data) => setProfile(data.user)).catch((err) => setError(messageOf(err))); }, [session.token]);
  return <div className="page-stack"><PageHeader eyebrow="Account" title="Profile and security" description="Manage your identity and login credentials." />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}<div className="split-panels"><Card className="form-card"><Card.Header><h3>Profile</h3></Card.Header><Card.Content><Field label="Display name" value={profile.displayName} onChange={(displayName) => setProfile({ ...profile, displayName })} /><Field label="Email" type="email" value={profile.email ?? ""} onChange={(email) => setProfile({ ...profile, email })} />{tenant ? <><Field label={tenant.userIdentifierLabel} value={profile.userIdentifier ?? ""} onChange={(userIdentifier) => setProfile({ ...profile, userIdentifier })} /><Field label={tenant.newUserIdentifierLabel} value={profile.newUserIdentifier ?? ""} onChange={(newUserIdentifier) => setProfile({ ...profile, newUserIdentifier })} /></> : null}<ConfirmAction label="Save profile" title="Save profile changes?" description="Your session will update immediately." onConfirm={async () => { const next = await api.updateProfile(session.token, { displayName: profile.displayName, email: profile.email, userIdentifier: profile.userIdentifier, newUserIdentifier: profile.newUserIdentifier }); onSession(next); setProfile(next.user); setNotice("Profile updated"); }} /></Card.Content></Card><Card className="form-card"><Card.Header><h3>Password</h3></Card.Header><Card.Content><Field label="Current password" type="password" value={passwords.currentPassword} onChange={(currentPassword) => setPasswords({ ...passwords, currentPassword })} /><Field label="New password" type="password" value={passwords.newPassword} onChange={(newPassword) => setPasswords({ ...passwords, newPassword })} /><ConfirmAction label="Change password" title="Change your password?" description="Use the new password the next time you sign in." disabled={!passwords.currentPassword || passwords.newPassword.length < 8} onConfirm={async () => { await api.updatePassword(session.token, passwords); setPasswords({ currentPassword: "", newPassword: "" }); setNotice("Password changed"); }} /></Card.Content></Card></div></div>;
}

export function DashboardDetails({ token, role, tenant, dashboard, onNavigate }: { token: string; role: Role; tenant: Tenant | null; dashboard: DashboardResponse | null; onNavigate: (view: string) => void }) {
  const [people, setPeople] = useState<Person[]>([]); const [groups, setGroups] = useState<MemberGroup[]>([]); const [tenants, setTenants] = useState<Tenant[]>([]); const [systems, setSystems] = useState<AvailableSystem[]>([]); const [records, setRecords] = useState<AttendanceRecord[]>([]);
  useEffect(() => { if (role === "super_admin") { Promise.all([api.tenants(token), api.systems(token)]).then(([a, b]) => { setTenants(a.tenants); setSystems(b.systems); }); } else { Promise.all([api.people(token), api.memberGroups(token), api.attendance(token, { fromDate: today(), toDate: today(), audience: "member" })]).then(([a, b, c]) => { setPeople(a.people); setGroups(b.groups); setRecords(c.records); }).catch(() => undefined); } }, [role, token, dashboard]);
  if (role === "super_admin") return <div className="dashboard-live-panels"><Card className="hero-panel"><Card.Header><h2>Recent tenants</h2></Card.Header><Card.Content>{tenants.slice(0, 5).map((item) => <div className="live-row" key={item.id}><div><strong>{item.name}</strong><span>{item.slug}</span></div><Chip variant="soft" color={item.status === "active" ? "success" : "warning"}>{item.status}</Chip></div>)}{!tenants.length ? <span>No tenants created yet.</span> : null}<Button variant="outline" onPress={() => onNavigate("people")}>Manage tenants</Button></Card.Content></Card><Card className="hero-panel"><Card.Header><h2>Systems</h2></Card.Header><Card.Content>{systems.map((item) => <div className="live-row" key={item.code}><div><strong>{item.name}</strong><span>{item.enabledTenantCount ?? 0} enabled tenants</span></div><Chip variant="soft">{item.status}</Chip></div>)}{!systems.length ? <span>No systems available.</span> : null}<Button variant="outline" onPress={() => onNavigate("systems")}>System settings</Button></Card.Content></Card></div>;
  return <div className="dashboard-live-panels"><Card className="hero-panel"><Card.Header><h2>{tenant?.memberPlural ?? "Members"}</h2></Card.Header><Card.Content><div className="summary-list"><div><span>Total users</span><strong>{people.length}</strong></div><div><span>Active</span><strong>{people.filter((person) => person.status === "active").length}</strong></div><div><span>Pending setup</span><strong>{people.filter((person) => person.requiresOnboarding).length}</strong></div><div><span>{tenant?.memberGroupPlural ?? "Groups"}</span><strong>{groups.length}</strong></div></div></Card.Content></Card><Card className="hero-panel"><Card.Header><h2>Today’s member attendance</h2></Card.Header><Card.Content>{records.slice(0, 5).map((item) => <div className="live-row" key={item.id}><strong>{item.personName}</strong><Chip variant="soft" color={item.status === "present" ? "success" : "warning"}>{item.status}</Chip></div>)}{!records.length ? <span>No member attendance recorded today.</span> : null}<Button variant="primary" onPress={() => onNavigate("attendance")}><CalendarCheck size={16} />Open attendance</Button></Card.Content></Card></div>;
}
