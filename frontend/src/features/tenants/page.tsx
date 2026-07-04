import { useCallback, useEffect, useState } from "react";
import { Button, Card, Checkbox, Chip, Tabs } from "@heroui/react";
import { Pencil, RefreshCw, X } from "lucide-react";
import { api, type Tenant, type TenantFeature } from "../../shared/api/client";
import { ConfirmAction, DataTable, LoadingState, Notice, PageHeader } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { boolValue, messageOf, tenantDefaults } from "../../shared/page-utils";

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
