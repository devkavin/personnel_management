import { useEffect, useState } from "react";
import { Button, Card, Checkbox, Chip, TextArea } from "@heroui/react";
import { RotateCcw } from "lucide-react";
import { api, type AttendanceStatus, type AvailableSystem, type SystemDashboardResponse, type SystemSetting, type TenantSystemSetting } from "../../shared/api/client";
import { ConfirmAction, DataTable, LoadingState, Notice, PageHeader, SearchableSelect } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { useUnsavedChanges } from "../../shared/hooks/useUnsavedChanges";
import { boolValue, messageOf } from "../../shared/page-utils";

export function SystemsPage({ token }: { token: string }) {
  const [systems, setSystems] = useState<AvailableSystem[]>([]);
  const [selected, setSelected] = useState("");
  const [dashboard, setDashboard] = useState<SystemDashboardResponse | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSystemSetting[]>([]);
  const [baseline, setBaseline] = useState<{ system: AvailableSystem | null; settings: SystemSetting[]; tenantSettings: TenantSystemSetting[] }>({ system: null, settings: [], tenantSettings: [] });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");

  useEffect(() => { api.systems(token).then((data) => { setSystems(data.systems); setSelected((value) => value || data.systems[0]?.code || ""); }).catch((err) => setError(messageOf(err))); }, [token]);
  useEffect(() => { if (!selected) return; setLoading(true); Promise.all([api.systemDashboard(token, selected), api.systemSettings(token, selected), api.systemTenantSettings(token, selected)]).then(([dash, config, tenants]) => { setDashboard(dash); setSettings(config.settings); setTenantSettings(tenants.tenantSettings); setBaseline((value) => ({ ...value, settings: config.settings, tenantSettings: tenants.tenantSettings })); setError(""); }).catch((err) => setError(messageOf(err))).finally(() => setLoading(false)); }, [selected, token]);
  useEffect(() => { if (!selected || baseline.system?.code === selected) return; const loadedSystem = systems.find((item) => item.code === selected); if (loadedSystem) setBaseline((value) => ({ ...value, system: { ...loadedSystem } })); }, [baseline.system?.code, selected, systems]);
  const system = systems.find((item) => item.code === selected);
  const setting = (key: string) => settings.find((item) => item.key === key)?.value;
  const systemDirty = Boolean(system && baseline.system && JSON.stringify(system) !== JSON.stringify(baseline.system)) || JSON.stringify(settings) !== JSON.stringify(baseline.settings);
  const tenantsDirty = JSON.stringify(tenantSettings) !== JSON.stringify(baseline.tenantSettings);
  useUnsavedChanges(systemDirty || tenantsDirty);

  async function saveSystem() {
    if (!system) return;
    await api.updateSystemSettings(token, selected, { name: system.name, description: system.description, status: system.status, settings: { defaultAttendanceStatus: setting("default_attendance_status") as AttendanceStatus | undefined, notesEnabled: setting("notes_enabled") === "true" } });
    setBaseline((value) => ({ ...value, system: { ...system }, settings: settings.map((item) => ({ ...item })) }));
    setNotice("System settings saved");
  }

  function resetChanges() {
    if (baseline.system) setSystems((items) => items.map((item) => item.code === selected ? { ...baseline.system! } : item));
    setSettings(baseline.settings.map((item) => ({ ...item })));
    setTenantSettings(baseline.tenantSettings.map((item) => ({ ...item })));
    setNotice("Unsaved changes were reset");
  }

  return <div className="page-stack"><PageHeader eyebrow="Super admin" title="Available systems" description="Inspect system adoption and configure global and tenant-level behavior." />{notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}
    <div className="system-picker-row"><SearchableSelect label="System" value={selected} disabled={systemDirty || tenantsDirty} onChange={setSelected} options={systems.map((item) => ({ value: item.code, label: item.name, meta: item.status }))} />{systemDirty || tenantsDirty ? <Button variant="secondary" onPress={resetChanges}><RotateCcw size={16} />Reset unsaved changes</Button> : null}</div>
    {loading ? <LoadingState /> : dashboard ? <div className="metric-row"><Metric label="Tenants" value={dashboard.stats.totalTenants} /><Metric label="Enabled" value={dashboard.stats.enabledTenants} />{selected === "attendance" ? <><Metric label="Staff attendance" value={dashboard.stats.staffAttendanceTenants} /><Metric label="Member attendance" value={dashboard.stats.memberAttendanceTenants} /></> : <><Metric label="Session templates" value={dashboard.stats.sessionTemplates} /><Metric label="Published schedules" value={dashboard.stats.publishedSchedules} /></>}</div> : null}
    {system && !loading ? <Card className="form-card"><Card.Header><h3>System settings</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={system.name} onChange={(name) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, name } : item))} required error={!system.name.trim() ? "Name is required" : undefined} maxLength={100} /><label className="field-stack"><span className="field-label">Description</span><TextArea maxLength={500} value={system.description ?? ""} onChange={(event) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, description: event.target.value } : item))} /></label><SearchableSelect label="Status" value={system.status} onChange={(status) => setSystems((items) => items.map((item) => item.code === selected ? { ...item, status: status as "active" | "inactive" } : item))} options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />{settings.map((item) => item.type === "boolean" ? <Checkbox key={item.key} isSelected={item.value === "true"} onChange={(checked) => setSettings((items) => items.map((entry) => entry.key === item.key ? { ...entry, value: checked ? "true" : "false" } : entry))}>{item.name}</Checkbox> : <SearchableSelect key={item.key} label={item.name} value={item.value} onChange={(value) => setSettings((items) => items.map((entry) => entry.key === item.key ? { ...entry, value } : entry))} options={(item.options ?? []).map((value) => ({ value, label: value }))} />)}</div><div className="form-actions"><ConfirmAction label="Save settings" title="Save system settings?" description="These global defaults affect tenants using this system." disabled={!systemDirty || !system.name.trim()} onConfirm={saveSystem} /></div></Card.Content></Card> : null}
    <DataTable rows={tenantSettings} rowKey={(row) => row.tenantId} searchText={(row) => `${row.tenantName} ${row.tenantSlug}`} columns={[
      { header: "Tenant", render: (row) => <div className="primary-cell"><strong>{row.tenantName}</strong><span>{row.tenantSlug}</span></div> },
      { header: "System", render: (row) => <Chip color={boolValue(row.enabled) ? "success" : "warning"} variant="soft">{boolValue(row.enabled) ? "Enabled" : "Disabled"}</Chip> },
      ...(selected === "attendance" ? [{ header: "Attendance", render: (row: TenantSystemSetting) => <div className="row-actions"><Checkbox isSelected={boolValue(row.staffAttendanceEnabled)} onChange={(staffAttendanceEnabled) => setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? { ...item, staffAttendanceEnabled } : item))}>Staff</Checkbox><Checkbox isSelected={boolValue(row.memberAttendanceEnabled)} onChange={(memberAttendanceEnabled) => setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? { ...item, memberAttendanceEnabled } : item))}>Member</Checkbox></div> }] : []),
      { header: "Actions", render: (row) => { const saved = baseline.tenantSettings.find((item) => item.tenantId === row.tenantId); const rowDirty = JSON.stringify(row) !== JSON.stringify(saved); return <div className="row-actions"><ConfirmAction label="Save" title="Save tenant settings?" description={`This changes ${system?.name ?? "the system"} for ${row.tenantName}.`} disabled={!rowDirty} onConfirm={async () => { await api.updateSystemTenantSettings(token, selected, row.tenantId, { enabled: boolValue(row.enabled), settings: { staffAttendanceEnabled: boolValue(row.staffAttendanceEnabled), memberAttendanceEnabled: boolValue(row.memberAttendanceEnabled) } }); setBaseline((value) => ({ ...value, tenantSettings: value.tenantSettings.map((item) => item.tenantId === row.tenantId ? { ...row } : item) })); setNotice(`${row.tenantName} settings saved`); }} /><ConfirmAction variant={boolValue(row.enabled) ? "danger-soft" : "secondary"} label={boolValue(row.enabled) ? "Disable" : "Enable"} title="Update tenant system?" description={`This changes ${system?.name ?? "the system"} for ${row.tenantName}.`} onConfirm={async () => { const enabled = !boolValue(row.enabled); const updated = { ...row, enabled }; await api.updateSystemTenantSettings(token, selected, row.tenantId, { enabled, settings: { staffAttendanceEnabled: boolValue(row.staffAttendanceEnabled), memberAttendanceEnabled: boolValue(row.memberAttendanceEnabled) } }); setTenantSettings((items) => items.map((item) => item.tenantId === row.tenantId ? updated : item)); setBaseline((value) => ({ ...value, tenantSettings: value.tenantSettings.map((item) => item.tenantId === row.tenantId ? updated : item) })); }} /></div>; } }
    ]} />
  </div>;
}

function Metric({ label, value }: { label: string; value: unknown }) { return <Card className="stat-card"><Card.Content><span>{label}</span><strong>{Number(value ?? 0).toLocaleString()}</strong></Card.Content></Card>; }
