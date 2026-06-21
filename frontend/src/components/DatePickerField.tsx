import { Calendar, DatePicker } from "@heroui/react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { CalendarDays } from "lucide-react";

interface DatePickerFieldProps {
  isRequired?: boolean;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}

function parseIsoDate(value: string) {
  try {
    return value ? parseDate(value) : null;
  } catch {
    return null;
  }
}

export function DatePickerField({ isRequired = false, label, onChange, value }: DatePickerFieldProps) {
  const selectedDate = parseIsoDate(value);

  function handleChange(nextDate: CalendarDate | null) {
    if (!nextDate) return;
    onChange(nextDate.toString());
  }

  return (
    <label className="date-picker-field" data-ignore-dirty="true">
      {label ? <span>{label}</span> : null}
      <DatePicker className="hero-date-picker" value={selectedDate} onChange={handleChange} isRequired={isRequired}>
        <DatePicker.Trigger className="hero-date-trigger">
          <span>{value || "Select date"}</span>
          <DatePicker.TriggerIndicator>
            <CalendarDays size={17} />
          </DatePicker.TriggerIndicator>
        </DatePicker.Trigger>
        <DatePicker.Popover className="hero-date-popover" placement="bottom end">
          <Calendar>
            <Calendar.Header>
              <Calendar.NavButton slot="previous" />
              <Calendar.Heading />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
              <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </label>
  );
}
