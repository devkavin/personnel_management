import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Modal, Tabs, TextArea } from "@heroui/react";
import { Pencil, RefreshCw, X } from "lucide-react";
import { api, type MemberGroup, type Person, type Role, type Tenant } from "../../shared/api/client";
import { ConfirmAction, DataTable, Notice, PageHeader, SearchableMultiSelect, SearchableSelect } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { memberIds, messageOf, roleOptions } from "../../shared/page-utils";

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
