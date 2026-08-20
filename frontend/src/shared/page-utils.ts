import type { MemberGroup } from "./api/client";

export const roleOptions = [
  { value: "tenant_admin", label: "Tenant admin" },
  { value: "tenant_staff", label: "Staff" },
  { value: "tenant_member", label: "Member" }
];
export const statusOptions = ["present", "absent", "late", "excused"].map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1)
}));
export const boolValue = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";
export const today = (timezone?: string) => {
  if (!timezone) return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
export const messageOf = (error: unknown) => error instanceof Error ? error.message : "Request failed";

const supportedTimezones = (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? ["Asia/Colombo", "UTC"];
export const timezoneOptions = [...new Set(["Asia/Colombo", ...supportedTimezones])].map((timezone) => {
  const offset = new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "longOffset" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return { value: timezone, label: timezone.replaceAll("_", " "), meta: offset };
});

export function memberIds(group: MemberGroup) {
  if (Array.isArray(group.members)) {
    return group.members
      .filter((member): member is { id: number; displayName: string } => Boolean(member?.id))
      .map((member) => Number(member.id));
  }
  if (!group.members) return [];
  try {
    return (JSON.parse(group.members) as Array<{ id: number } | null>)
      .filter((member): member is { id: number } => Boolean(member?.id))
      .map((member) => Number(member.id));
  } catch {
    return [];
  }
}

export const tenantDefaults = {
  name: "", slug: "", personSingular: "person", personPlural: "people", staffSingular: "staff", staffPlural: "staff",
  memberSingular: "member", memberPlural: "members", userIdentifierLabel: "User ID", newUserIdentifierLabel: "New User ID",
  memberGroupSingular: "Class", memberGroupPlural: "Classes", timezone: "Asia/Colombo"
};
