import { AppError } from "../../shared/http.js";

export interface DatedTemplateEntry {
  weekday: number;
  slotId: number;
  sessionTemplateId: number;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || isoDate(date) !== value) throw new AppError(422, "Invalid schedule date");
  return date;
}

export function generateScheduleDates(startDate: string, endDate: string, mode: "day" | "week" | "range") {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (end < start) throw new AppError(422, "End date must be on or after start date");
  const maximumDays = mode === "day" ? 1 : mode === "week" ? 7 : 366;
  const dayCount = Math.floor((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
  if (dayCount > maximumDays) throw new AppError(422, `Schedule range cannot exceed ${maximumDays} days`);
  if (mode === "day" && dayCount !== 1) throw new AppError(422, "Day schedules must use one date");

  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return { date: isoDate(date), weekday: date.getUTCDay() === 0 ? 7 : date.getUTCDay() };
  });
}

export function expandTemplateEntries(
  dates: Array<{ date: string; weekday: number }>,
  entries: DatedTemplateEntry[]
) {
  const byWeekday = new Map<number, DatedTemplateEntry[]>();
  for (const entry of entries) byWeekday.set(entry.weekday, [...(byWeekday.get(entry.weekday) ?? []), entry]);
  return dates.flatMap(({ date, weekday }) => (byWeekday.get(weekday) ?? []).map((entry) => ({ ...entry, date })));
}

export function wouldCreateTaxonomyCycle(nodeId: number, nextParentId: number | null, parents: Map<number, number | null>) {
  let cursor = nextParentId;
  const visited = new Set<number>();
  while (cursor !== null) {
    if (cursor === nodeId) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parents.get(cursor) ?? null;
  }
  return false;
}
