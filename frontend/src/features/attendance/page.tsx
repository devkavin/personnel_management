import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Chip, SearchField, Tabs, TextArea } from "@heroui/react";
import { CalendarCheck, CheckCheck, RefreshCw, RotateCcw, Search, UsersRound } from "lucide-react";
import { api, type AttendanceAudience, type AttendanceRecord, type AttendanceStatus, type MemberGroup, type Person, type Tenant } from "../../shared/api/client";
import { AppDatePicker, ConfirmAction, DataTable, LoadingState, Notice, PageHeader, SearchableSelect } from "../../shared/components";
import { boolValue, memberIds, messageOf, statusOptions, today } from "../../shared/page-utils";

const statusTone: Record<AttendanceStatus, "success" | "danger" | "warning" | "accent"> = {
  present: "success",
  absent: "danger",
  late: "warning",
  excused: "accent"
};

function Summary({ records, pending }: { records: AttendanceRecord[]; pending?: number }) {
  return <div className="attendance-summary-grid">
    {pending !== undefined ? <Card className="attendance-summary-card"><Card.Content><span>Ready to save</span><strong>{pending}</strong></Card.Content></Card> : null}
    {statusOptions.map((item) => <Card key={item.value} className={`attendance-summary-card summary-${item.value}`}><Card.Content><span>{item.label}</span><strong>{records.filter((record) => record.status === item.value).length}</strong></Card.Content></Card>)}
  </div>;
}

export function AttendancePage({ token, tenant, features, onChanged }: { token: string; tenant: Tenant; features: Array<{ code: string; enabled: boolean | number }>; onChanged: () => void }) {
  const memberEnabled = features.some((item) => item.code === "attendance_member" && boolValue(item.enabled));
  const staffEnabled = features.some((item) => item.code === "attendance_staff" && boolValue(item.enabled));
  const availableAudiences = useMemo(() => [
    { value: "member" as const, label: tenant.memberPlural },
    { value: "staff" as const, label: tenant.staffPlural }
  ].filter((item) => item.value === "member" ? memberEnabled : staffEnabled), [memberEnabled, staffEnabled, tenant.memberPlural, tenant.staffPlural]);

  const [tab, setTab] = useState("record");
  const [audience, setAudience] = useState<AttendanceAudience>(availableAudiences[0]?.value ?? "member");
  const [date, setDate] = useState(() => today(tenant.timezone));
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<MemberGroup[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [users, attendance, classes] = await Promise.all([
        api.people(token),
        api.attendance(token, { audience, fromDate: date, toDate: date }),
        api.memberGroups(token)
      ]);
      setPeople(users.people);
      setRecords(attendance.records);
      setGroups(classes.groups);
      setError("");
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, [audience, date, token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (audience === "staff") setSelectedGroup(""); }, [audience]);

  const eligiblePeople = useMemo(() => {
    const group = groups.find((item) => String(item.id) === selectedGroup);
    const groupedIds = group ? new Set(memberIds(group)) : null;
    return people
      .filter((person) => person.status === "active")
      .filter((person) => audience === "staff" ? person.role === "tenant_staff" : person.role === "tenant_member")
      .filter((person) => !groupedIds || groupedIds.has(person.id));
  }, [audience, groups, people, selectedGroup]);

  const existingByPerson = useMemo(() => new Map(records.map((record) => [record.personId, record])), [records]);
  const unrecordedPeople = useMemo(() => eligiblePeople.filter((person) => !existingByPerson.has(person.id)), [eligiblePeople, existingByPerson]);

  useEffect(() => {
    setSelectedIds(unrecordedPeople.map((person) => person.id));
    setStatuses(Object.fromEntries(unrecordedPeople.map((person) => [person.id, "present"])));
  }, [audience, date, selectedGroup, unrecordedPeople]);

  const visiblePeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return eligiblePeople
      .filter((person) => !query || `${person.displayName} ${person.userIdentifier ?? ""}`.toLowerCase().includes(query))
      .sort((left, right) => Number(existingByPerson.has(left.id)) - Number(existingByPerson.has(right.id)) || left.displayName.localeCompare(right.displayName));
  }, [eligiblePeople, existingByPerson, search]);

  const activeGroups = groups.filter((group) => group.status === "active");
  const selectedSet = new Set(selectedIds);
  const selectedRecords = selectedIds.map((personId) => ({ personId, status: statuses[personId] ?? "present", notes: notes.trim() || undefined }));
  const filteredRecords = records.filter((record) => eligiblePeople.some((person) => person.id === record.personId));

  function chooseAudience(next: AttendanceAudience) {
    setAudience(next);
    setSearch("");
    setNotice("");
  }

  return <div className="page-stack attendance-page">
    <PageHeader eyebrow={tenant.name} title="Attendance" description="Mark a roster quickly, then review the completed day." actions={<Button variant="outline" onPress={() => void load()}><RefreshCw size={16} />Refresh</Button>} />
    {notice ? <Notice message={notice} tone="success" /> : null}{error ? <Notice message={error} tone="danger" /> : null}

    <Tabs className="module-tabs" selectedKey={tab} onSelectionChange={(key) => setTab(String(key))} aria-label="Attendance pages">
      <Tabs.ListContainer><Tabs.List aria-label="Attendance pages">
        <Tabs.Tab id="record"><CheckCheck size={17} />Record attendance<Tabs.Indicator /></Tabs.Tab>
        <Tabs.Tab id="daily"><CalendarCheck size={17} />Daily attendance<Tabs.Indicator /></Tabs.Tab>
      </Tabs.List></Tabs.ListContainer>

      <Tabs.Panel id="record"><div className="attendance-workflow">
        <Card className="attendance-controls-card"><Card.Content><div className="attendance-controls">
          <div className="field-stack"><span className="field-label">Who are you marking?</span><div className="attendance-audience-switch">{availableAudiences.map((item) => <Button key={item.value} variant={audience === item.value ? "primary" : "secondary"} onPress={() => chooseAudience(item.value)}>{item.value === "member" ? <UsersRound size={16} /> : <CalendarCheck size={16} />}{item.label}</Button>)}</div></div>
          <div className="attendance-date-control"><AppDatePicker label="Attendance date" value={date} onChange={setDate} /><Button variant="outline" onPress={() => setDate(today(tenant.timezone))}><CalendarCheck size={16} />Today</Button></div>
          {audience === "member" ? <SearchableSelect label={tenant.memberGroupSingular} clearable value={selectedGroup} onChange={setSelectedGroup} placeholder={`All ${tenant.memberPlural}`} options={activeGroups.map((group) => ({ value: String(group.id), label: group.name, meta: `${group.memberCount} ${tenant.memberPlural.toLowerCase()}` }))} /> : <div className="attendance-context-note"><span>Staff roster</span><strong>{tenant.staffPlural}</strong></div>}
        </div></Card.Content></Card>

        <Summary records={filteredRecords} pending={selectedIds.length} />

        <Card className="attendance-roster-card">
          <Card.Header><div><h3>{audience === "staff" ? tenant.staffPlural : tenant.memberPlural}</h3><p>{records.length ? `${records.length} already recorded. Unmarked people are shown first.` : "Everyone unmarked is selected as Present. Tap only the exceptions."}</p></div><Chip variant="soft" color="accent">{unrecordedPeople.length} unmarked</Chip></Card.Header>
          <Card.Content>
            <div className="attendance-roster-toolbar">
              <SearchField value={search} onChange={setSearch} aria-label="Search roster"><SearchField.Group><SearchField.SearchIcon /><SearchField.Input placeholder={`Search ${audience === "staff" ? tenant.staffPlural : tenant.memberPlural}`} /><SearchField.ClearButton /></SearchField.Group></SearchField>
              <div className="row-actions"><Button size="sm" variant="secondary" onPress={() => setSelectedIds(unrecordedPeople.map((person) => person.id))}><CheckCheck size={15} />Select unmarked</Button><Button size="sm" variant="ghost" onPress={() => setSelectedIds([])}><RotateCcw size={15} />Clear</Button></div>
            </div>

            {loading ? <LoadingState /> : visiblePeople.length === 0 ? <div className="empty-state"><Search size={20} /><strong>No people match this roster</strong><span>Try a different class or search.</span></div> : <div className="attendance-roster-list">{visiblePeople.map((person) => {
              const existing = existingByPerson.get(person.id);
              const selected = selectedSet.has(person.id);
              return <div key={person.id} className={`attendance-roster-row ${existing ? "recorded" : ""}`}>
                <Checkbox isSelected={selected || Boolean(existing)} isDisabled={Boolean(existing)} onChange={(checked) => setSelectedIds((current) => checked ? [...new Set([...current, person.id])] : current.filter((id) => id !== person.id))} aria-label={`Select ${person.displayName}`} />
                <div className="primary-cell"><strong>{person.displayName}</strong><span>{person.userIdentifier || "No identifier"}{existing ? ` | Recorded by ${existing.recordedByName}` : ""}</span></div>
                {existing ? <Chip color={statusTone[existing.status]} variant="soft">{existing.status}</Chip> : <div className="attendance-status-picker" aria-label={`Attendance status for ${person.displayName}`}>{statusOptions.map((option) => <Button key={option.value} size="sm" variant={selected && statuses[person.id] === option.value ? "primary" : "ghost"} isDisabled={!selected} className={`status-${option.value}${selected && statuses[person.id] === option.value ? " selected" : ""}`} onPress={() => setStatuses((current) => ({ ...current, [person.id]: option.value as AttendanceStatus }))}>{option.label}</Button>)}</div>}
              </div>;
            })}</div>}

            <div className="attendance-save-panel">
              <label className="field-stack"><span className="field-label">Shared note <small>(optional)</small></span><TextArea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Add a note only when it applies to everyone selected." /></label>
              <div><span>{selectedIds.length} selected</span><ConfirmAction label="Save attendance" title={`Save ${selectedIds.length} attendance record${selectedIds.length === 1 ? "" : "s"}?`} description={`This records the selected ${audience === "staff" ? tenant.staffPlural.toLowerCase() : tenant.memberPlural.toLowerCase()} for ${date}.`} disabled={selectedIds.length === 0 || loading} onConfirm={async () => { const result = await api.createAttendanceBatch(token, { audience, attendanceDate: date, records: selectedRecords }); setNotice(`${result.count} attendance record${result.count === 1 ? "" : "s"} saved`); setNotes(""); await load(); onChanged(); }} /></div>
            </div>
          </Card.Content>
        </Card>
      </div></Tabs.Panel>

      <Tabs.Panel id="daily"><div className="page-stack">
        <Card className="attendance-controls-card"><Card.Content><div className="attendance-controls daily-controls">
          <SearchableSelect label="Audience" value={audience} onChange={(value) => chooseAudience(value as AttendanceAudience)} options={availableAudiences} />
          <div className="attendance-date-control"><AppDatePicker label="Day" value={date} onChange={setDate} /><Button variant="outline" onPress={() => setDate(today(tenant.timezone))}><CalendarCheck size={16} />Today</Button></div>
          {audience === "member" ? <SearchableSelect label={tenant.memberGroupSingular} clearable value={selectedGroup} onChange={setSelectedGroup} placeholder={`All ${tenant.memberPlural}`} options={activeGroups.map((group) => ({ value: String(group.id), label: group.name }))} /> : null}
        </div></Card.Content></Card>
        <Summary records={filteredRecords} />
        {loading ? <LoadingState /> : <DataTable rows={filteredRecords} rowKey={(row) => row.id} searchText={(row) => `${row.personName} ${row.recordedByName} ${row.status} ${row.notes ?? ""}`} empty="No attendance has been recorded for this day." columns={[
          { header: "Person", render: (row) => <strong>{row.personName}</strong> },
          { header: "Status", render: (row) => <Chip color={statusTone[row.status]} variant="soft">{row.status}</Chip> },
          { header: "Recorded by", render: (row) => row.recordedByName },
          { header: "Notes", render: (row) => row.notes || "No note" }
        ]} />}
      </div></Tabs.Panel>
    </Tabs>
  </div>;
}
