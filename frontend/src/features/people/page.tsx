import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Modal, Tabs, TextArea } from "@heroui/react";
import { Pencil, RefreshCw, X } from "lucide-react";
import { z } from "zod";
import { api, type MemberGroup, type Person, type Role, type Tenant } from "../../shared/api/client";
import { ConfirmAction, DataTable, LoadingState, Notice, PageHeader, SearchableMultiSelect, SearchableSelect } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { memberIds, messageOf } from "../../shared/page-utils";

const identifierPattern = /^[A-Z0-9/]+$/;
const identifierSchema = z.string().trim().min(1, "Enter a User ID").regex(identifierPattern, "Use letters, numbers, and / only");
const completeAccountSchema = z.object({ displayName: z.string().trim().min(2, "Enter at least 2 characters"), email: z.email("Enter a valid email address"), password: z.string().min(8, "Use at least 8 characters"), userIdentifier: z.string().refine((value) => !value || identifierPattern.test(value), "Use letters, numbers, and / only") });

export function PeoplePage({ token, tenant, role, onChanged }: { token: string; tenant: Tenant; role: Role; onChanged: () => void }) {
  const [people, setPeople] = useState<Person[]>([]); const [groups, setGroups] = useState<MemberGroup[]>([]); const [tab, setTab] = useState("manage");
  const [editing, setEditing] = useState<Person | null>(null); const [originalUser, setOriginalUser] = useState<Person | null>(null); const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [discardUserOpen, setDiscardUserOpen] = useState(false);
  const [single, setSingle] = useState({ userIdentifier: "", role: role === "tenant_staff" ? "tenant_member" : "tenant_member", memberGroupId: "" });
  const [full, setFull] = useState({ displayName: "", email: "", userIdentifier: "", newUserIdentifier: "", password: "", role: role === "tenant_staff" ? "tenant_member" : "tenant_member" });
  const [bulk, setBulk] = useState(""); const [bulkSetup, setBulkSetup] = useState({ role: "tenant_member", memberGroupId: "" }); const [group, setGroup] = useState<{ name: string; description: string; memberIds?: number[] }>({ name: "", description: "" }); const [editingGroup, setEditingGroup] = useState<MemberGroup | null>(null); const [originalGroup, setOriginalGroup] = useState<MemberGroup | null>(null); const [discardGroupOpen, setDiscardGroupOpen] = useState(false);
  const tenantRoleOptions = [{ value: "tenant_admin", label: "Tenant admin" }, { value: "tenant_staff", label: `Staff / ${tenant.staffSingular}` }, { value: "tenant_member", label: `Member / ${tenant.memberSingular}` }];
  const allowedRoles = role === "tenant_staff" ? tenantRoleOptions.filter((item) => item.value === "tenant_member") : tenantRoleOptions;
  const bulkCount = useMemo(() => bulk.split(/[\s,;]+/).filter(Boolean).length, [bulk]);
  const invalidBulkIdentifier = useMemo(() => bulk.split(/[\s,;]+/).filter(Boolean).find((value) => !identifierPattern.test(value)), [bulk]);
  const memberOptions = useMemo(() => people.filter((person) => person.role === "tenant_member").map((person) => {
    const classNames = groups.filter((item) => memberIds(item).includes(person.id)).map((item) => item.name);
    const membership = classNames.length > 0 ? `${tenant.memberGroupPlural}: ${classNames.join(", ")}` : `No ${tenant.memberGroupSingular.toLowerCase()}`;
    return { value: String(person.id), label: person.displayName, meta: [person.userIdentifier, membership].filter(Boolean).join(" | ") };
  }), [groups, people, tenant.memberGroupPlural, tenant.memberGroupSingular]);
  const groupNamesForPerson = (personId: number) => groups.filter((item) => memberIds(item).includes(personId)).map((item) => item.name);
  const load = useCallback(async () => { setLoading(true); try { const [users, classes] = await Promise.all([api.people(token), api.memberGroups(token)]); setPeople(users.people); setGroups(classes.groups); setError(""); } catch (err) { setError(messageOf(err)); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]);

  function validateSingle() {
    const result = identifierSchema.safeParse(single.userIdentifier);
    setFieldErrors(result.success ? {} : { singleIdentifier: result.error.issues[0]?.message ?? "Invalid User ID" });
    return result.success;
  }

  function validateCompleteAccount() {
    const result = completeAccountSchema.safeParse(full);
    setFieldErrors(result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [`full.${String(issue.path[0])}`, issue.message])));
    return result.success;
  }

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
      <Tabs.Panel id="manage">{userEditor}{loading ? <LoadingState /> : <DataTable rows={people} rowKey={(row) => row.id} searchText={(row) => `${row.displayName} ${row.email} ${row.userIdentifier} ${row.role} ${row.status} ${groupNamesForPerson(row.id).join(" ")}`} columns={[
        { header: tenant.userIdentifierLabel, render: (row) => <strong>{row.newUserIdentifier || row.userIdentifier || "—"}</strong> },
        { header: "Name", render: (row) => <div className="primary-cell"><strong>{row.displayName}</strong><span>{row.email || "Onboarding pending"}</span></div> },
        { header: "Role", render: (row) => <Chip variant="soft">{row.role.replace("tenant_", "")}</Chip> },
        { header: tenant.memberGroupPlural, render: (row) => { const memberships = groupNamesForPerson(row.id); return memberships.length > 0 ? <div className="membership-list">{memberships.map((name) => <Chip key={name} size="sm" variant="soft">{name}</Chip>)}</div> : <span className="membership-empty">No {tenant.memberGroupSingular.toLowerCase()}</span>; } },
        { header: "Status", render: (row) => <Chip color={row.requiresOnboarding ? "warning" : row.status === "active" ? "success" : "danger"} variant="soft">{row.requiresOnboarding ? "Pending setup" : row.status}</Chip> },
        { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={() => { setOriginalUser({ ...row }); setEditing({ ...row }); }}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title="Deactivate user?" description={`${row.displayName} will no longer be able to sign in.`} onConfirm={async () => { await api.deactivatePerson(token, row.id); await load(); onChanged(); }} /></div> }
      ]} />}</Tabs.Panel>
      <Tabs.Panel id="onboard"><div className="split-panels"><Card className="form-card"><Card.Header><h3>Single onboarding</h3></Card.Header><Card.Content><Field label={tenant.userIdentifierLabel} value={single.userIdentifier} error={fieldErrors.singleIdentifier} onChange={(userIdentifier) => setSingle({ ...single, userIdentifier: userIdentifier.toUpperCase() })} required /><SearchableSelect label="Role" value={single.role} onChange={(nextRole) => setSingle({ ...single, role: nextRole })} options={allowedRoles} /><SearchableSelect label={tenant.memberGroupSingular} value={single.memberGroupId} onChange={(memberGroupId) => setSingle({ ...single, memberGroupId })} options={groups.map((item) => ({ value: String(item.id), label: item.name }))} /><ConfirmAction label="Onboard user" title="Create onboarding account?" description="The user will complete their profile at first login." validate={validateSingle} onConfirm={async () => { await api.onboardPerson(token, { userIdentifier: single.userIdentifier, role: single.role as Person["role"], memberGroupId: single.memberGroupId ? Number(single.memberGroupId) : undefined }); setSingle({ ...single, userIdentifier: "" }); setFieldErrors({}); setNotice("User onboarded"); await load(); onChanged(); }} /></Card.Content></Card>
        <Card className="form-card"><Card.Header><h3>Bulk onboarding</h3></Card.Header><Card.Content>
          <div className="form-grid"><SearchableSelect label="Role" value={bulkSetup.role} onChange={(nextRole) => setBulkSetup({ role: nextRole, memberGroupId: nextRole === "tenant_member" ? bulkSetup.memberGroupId : "" })} options={allowedRoles} />{bulkSetup.role === "tenant_member" ? <SearchableSelect label={tenant.memberGroupSingular} clearable value={bulkSetup.memberGroupId} onChange={(memberGroupId) => setBulkSetup({ ...bulkSetup, memberGroupId })} options={groups.filter((item) => item.status === "active").map((item) => ({ value: String(item.id), label: item.name }))} /> : null}</div>
          <label className="field-stack"><span className="field-label">{tenant.userIdentifierLabel}s (up to 1000)</span><TextArea rows={10} value={bulk} onChange={(event) => setBulk(event.target.value.toUpperCase())} placeholder="One identifier per line, separated by a comma, space, semicolon, or new line." />{invalidBulkIdentifier ? <span className="field-error">{invalidBulkIdentifier} contains unsupported characters.</span> : null}</label>
          <div className="bulk-import-summary"><div><span>Accounts</span><strong>{bulkCount}</strong></div><div><span>Role</span><strong>{allowedRoles.find((item) => item.value === bulkSetup.role)?.label}</strong></div><div><span>{tenant.memberGroupSingular}</span><strong>{groups.find((item) => String(item.id) === bulkSetup.memberGroupId)?.name ?? "Not assigned"}</strong></div></div>
          <ConfirmAction label="Bulk onboard" title={`Create ${bulkCount} onboarding account${bulkCount === 1 ? "" : "s"}?`} description={`Role: ${allowedRoles.find((item) => item.value === bulkSetup.role)?.label}. ${tenant.memberGroupSingular}: ${groups.find((item) => String(item.id) === bulkSetup.memberGroupId)?.name ?? "Not assigned"}.`} disabled={bulkCount === 0 || bulkCount > 1000 || Boolean(invalidBulkIdentifier)} onConfirm={async () => { const result = await api.bulkOnboardPeople(token, { userIdentifiers: bulk, role: bulkSetup.role as Person["role"], memberGroupId: bulkSetup.memberGroupId ? Number(bulkSetup.memberGroupId) : undefined }); setBulk(""); setNotice(`${result.created} created, ${result.skipped} skipped`); await load(); onChanged(); }} />
        </Card.Content></Card><Card className="form-card full-span"><Card.Header><h3>Create complete account</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Display name" value={full.displayName} error={fieldErrors["full.displayName"]} onChange={(displayName) => setFull({ ...full, displayName })} required /><Field label={tenant.userIdentifierLabel} value={full.userIdentifier} error={fieldErrors["full.userIdentifier"]} onChange={(userIdentifier) => setFull({ ...full, userIdentifier: userIdentifier.toUpperCase() })} /><Field label="Email" type="email" value={full.email} error={fieldErrors["full.email"]} onChange={(email) => setFull({ ...full, email })} required /><Field label="Password" type="password" value={full.password} error={fieldErrors["full.password"]} minLength={8} autoComplete="new-password" onChange={(password) => setFull({ ...full, password })} required /><SearchableSelect label="Role" value={full.role} onChange={(nextRole) => setFull({ ...full, role: nextRole })} options={allowedRoles} /></div><ConfirmAction label="Create account" title="Create complete user account?" description="This user can sign in immediately with the supplied credentials." validate={validateCompleteAccount} onConfirm={async () => { await api.createPerson(token, { ...full, role: full.role as Person["role"] }); setFull({ displayName: "", email: "", userIdentifier: "", newUserIdentifier: "", password: "", role: full.role }); setFieldErrors({}); setNotice("User account created"); await load(); onChanged(); }} /></Card.Content></Card></div></Tabs.Panel>
<Tabs.Panel id="groups"><Card className="form-card"><Card.Header><h3>Create {tenant.memberGroupSingular}</h3></Card.Header><Card.Content><div className="form-grid"><Field label="Name" value={group.name} onChange={(name) => setGroup({ ...group, name })} /><Field label="Description" value={group.description} onChange={(description) => setGroup({ ...group, description })} /></div><ConfirmAction label={`Create ${tenant.memberGroupSingular}`} title={`Create ${tenant.memberGroupSingular}?`} description="The group will be available for member filtering." disabled={!group.name} onConfirm={async () => { await api.createMemberGroup(token, { ...group, memberIds: [] }); setGroup({ name: "", description: "" }); setNotice(`${tenant.memberGroupSingular} created`); await load(); }} /></Card.Content></Card><DataTable rows={groups} rowKey={(row) => row.id} searchText={(row) => `${row.name} ${row.description} ${row.status}`} columns={[{ header: "Name", render: (row) => <div className="primary-cell"><strong>{row.name}</strong><span>{row.description || "No description"}</span></div> }, { header: "Members", render: (row) => row.memberCount }, { header: "Status", render: (row) => <Chip variant="soft">{row.status}</Chip> }, { header: "Actions", render: (row) => <div className="row-actions"><Button size="sm" variant="outline" onPress={() => openGroupEditor(row)}><Pencil size={15} />Edit</Button><ConfirmAction danger label="Deactivate" title={`Deactivate ${row.name}?`} description="The group will no longer be available for selection." onConfirm={async () => { await api.deactivateMemberGroup(token, row.id); await load(); }} /></div> }]} />{groupEditor}</Tabs.Panel>
    </Tabs>
  </div>;
}
