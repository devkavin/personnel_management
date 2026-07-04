import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, TextArea } from "@heroui/react";
import { RefreshCw } from "lucide-react";
import { api, type AttendanceAudience, type AttendanceRecord, type AttendanceStatus, type Person, type Tenant } from "../../shared/api/client";
import { ConfirmAction, DataTable, Notice, PageHeader, SearchableMultiSelect, SearchableSelect } from "../../shared/components";
import { Field } from "../../shared/components/Field";
import { boolValue, messageOf, statusOptions, today } from "../../shared/page-utils";

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
