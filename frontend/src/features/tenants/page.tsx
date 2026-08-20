import { useCallback, useEffect, useState } from "react";
import { Button, Card, Checkbox, Chip, Switch, Tabs } from "@heroui/react";
import { z } from "zod";
import { Pencil, RefreshCw, X } from "lucide-react";
import { api, type Tenant, type TenantFeature } from "../../shared/api/client";
import { ConfirmAction, DataTable, LoadingState, Notice, PageHeader } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { boolValue, messageOf, tenantDefaults } from "../../shared/page-utils";
import { useUnsavedChanges } from "../../shared/hooks/useUnsavedChanges";

const tenantSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters"),
  slug: z.string().trim().min(2, "Enter at least 2 characters").regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  personSingular: z.string().trim().min(2), personPlural: z.string().trim().min(2),
  staffSingular: z.string().trim().min(2), staffPlural: z.string().trim().min(2),
  memberSingular: z.string().trim().min(2), memberPlural: z.string().trim().min(2),
  userIdentifierLabel: z.string().trim().min(2), newUserIdentifierLabel: z.string().trim().min(2),
  memberGroupSingular: z.string().trim().min(2), memberGroupPlural: z.string().trim().min(2),
  timezone: z.string().min(1)
});
const adminSchema = z.object({ displayName: z.string().trim().min(2), email: z.email("Enter a valid email address"), userIdentifier: z.string(), password: z.string().min(8, "Use at least 8 characters") });

function issues(error: z.ZodError) {
  return Object.fromEntries(error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

export function TenantsPage({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tab, setTab] = useState("manage");
  const [form, setForm] = useState(tenantDefaults);
  const [admin, setAdmin] = useState({ displayName: "", email: "", userIdentifier: "", password: "" });
  const [createAdmin, setCreateAdmin] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [originalEditing, setOriginalEditing] = useState<Tenant | null>(null);
  const [featureFlags, setFeatureFlags] = useState<TenantFeature[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const registrationDirty = JSON.stringify(form) !== JSON.stringify(tenantDefaults) || createAdmin || Object.values(admin).some(Boolean);
  const editingDirty = Boolean(editing && originalEditing && (JSON.stringify(editing) !== JSON.stringify(originalEditing) || featureFlags.some((feature) => boolValue(feature.enabled) !== boolValue((originalEditing as Tenant & { features?: TenantFeature[] }).features?.find((item) => item.code === feature.code)?.enabled))));
  useUnsavedChanges(registrationDirty || editingDirty);

  const load = useCallback(async () => { setLoading(true); try { setTenants((await api.tenants(token)).tenants); setError(""); } catch (err) { setError(messageOf(err)); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);

  async function createTenant() {
    await api.createTenant(token, { ...form, admin: createAdmin ? { ...admin } : undefined });
    setForm(tenantDefaults); setAdmin({ displayName: "", email: "", userIdentifier: "", password: "" }); setCreateAdmin(false); setFieldErrors({}); setNotice("Tenant created successfully");
    await load(); onChanged(); setTab("manage");
  }

  function validateRegistration() {
    const tenantResult = tenantSchema.safeParse(form);
    const adminResult = createAdmin ? adminSchema.safeParse(admin) : null;
    const nextErrors = { ...(tenantResult.success ? {} : issues(tenantResult.error)), ...(adminResult && !adminResult.success ? Object.fromEntries(Object.entries(issues(adminResult.error)).map(([key, value]) => [`admin.${key}`, value])) : {}) };
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function validateEditing() {
    if (!editing) return false;
    const result = tenantSchema.safeParse(editing);
    setFieldErrors(result.success ? {} : issues(result.error));
    return result.success;
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
          { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={async () => { const flags = (await api.tenantFeatures(token, row.id)).features; setEditing({ ...row }); setOriginalEditing({ ...row, features: flags } as Tenant); setFeatureFlags(flags); setFieldErrors({}); }}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title="Deactivate tenant?" description={`Users in ${row.name} will lose access.`} onConfirm={async () => { await api.deactivateTenant(token, row.id); await load(); onChanged(); }} /></div> }
        ]} />}
        {editing ? <Card className="form-card"><Card.Header><h3>Edit {editing.name}</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={editing.name} error={fieldErrors.name} onChange={(name) => setEditing({ ...editing, name })} required /><Field label="Slug" value={editing.slug} error={fieldErrors.slug} onChange={(slug) => setEditing({ ...editing, slug })} required /><Field label="Staff singular" value={editing.staffSingular} error={fieldErrors.staffSingular} onChange={(staffSingular) => setEditing({ ...editing, staffSingular })} /><Field label="Staff plural" value={editing.staffPlural} error={fieldErrors.staffPlural} onChange={(staffPlural) => setEditing({ ...editing, staffPlural })} /><Field label="Member singular" value={editing.memberSingular} error={fieldErrors.memberSingular} onChange={(memberSingular) => setEditing({ ...editing, memberSingular })} /><Field label="Member plural" value={editing.memberPlural} error={fieldErrors.memberPlural} onChange={(memberPlural) => setEditing({ ...editing, memberPlural })} /><Field label="Identifier label" value={editing.userIdentifierLabel} error={fieldErrors.userIdentifierLabel} onChange={(userIdentifierLabel) => setEditing({ ...editing, userIdentifierLabel })} /><Field label="Group singular" value={editing.memberGroupSingular} error={fieldErrors.memberGroupSingular} onChange={(memberGroupSingular) => setEditing({ ...editing, memberGroupSingular })} />{featureFlags.map((feature) => <Checkbox key={feature.code} isSelected={boolValue(feature.enabled)} onChange={(enabled) => setFeatureFlags((items) => items.map((item) => item.code === feature.code ? { ...item, enabled } : item))}>{feature.name}</Checkbox>)}</div><div className="form-actions">{editingDirty ? <ConfirmAction danger variant="danger-soft" label="Discard" title="Discard tenant changes?" description="Your unsaved tenant and system settings will be lost." onConfirm={() => { setEditing(null); setOriginalEditing(null); setFieldErrors({}); }} /> : <Button variant="ghost" onPress={() => setEditing(null)}><X size={16} />Close</Button>}<ConfirmAction label="Save changes" title="Save tenant changes?" description="These settings affect terminology and feature access throughout this tenant." validate={validateEditing} onConfirm={updateTenant} /></div></Card.Content></Card> : null}
      </Tabs.Panel>
      <Tabs.Panel id="register"><Card className="form-card"><Card.Header><h3>Tenant details</h3></Card.Header><Card.Content><div className="form-grid">{Object.entries(form).map(([key, value]) => <Field key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())} value={value} error={fieldErrors[key]} required={["name", "slug"].includes(key)} onChange={(next) => setForm({ ...form, [key]: next })} />)}</div><div className="section-heading"><div><h3>Initial tenant admin</h3><p>Create the first administrator now, or leave this off and add one later.</p></div><Switch isSelected={createAdmin} onChange={setCreateAdmin}>Create initial administrator</Switch></div>{createAdmin ? <div className="form-grid"><Field label="Display name" value={admin.displayName} error={fieldErrors["admin.displayName"]} onChange={(displayName) => setAdmin({ ...admin, displayName })} required /><Field label="Email" type="email" value={admin.email} error={fieldErrors["admin.email"]} onChange={(email) => setAdmin({ ...admin, email })} required /><Field label="User ID" value={admin.userIdentifier} error={fieldErrors["admin.userIdentifier"]} onChange={(userIdentifier) => setAdmin({ ...admin, userIdentifier })} /><Field label="Temporary password" type="password" value={admin.password} error={fieldErrors["admin.password"]} minLength={8} autoComplete="new-password" onChange={(password) => setAdmin({ ...admin, password })} required /></div> : null}<div className="form-actions"><ConfirmAction label="Create tenant" title="Create this tenant?" description="The tenant and optional initial administrator will be created immediately." validate={validateRegistration} onConfirm={createTenant} /></div></Card.Content></Card></Tabs.Panel>
    </Tabs>
  </div>;
}
