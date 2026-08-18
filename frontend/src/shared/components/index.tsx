import { useMemo, useRef, useState, type Key, type ReactNode } from "react";
import { AlertDialog, Autocomplete, Button, Card, Chip, Dropdown, Header, Label, ListBox, Pagination, SearchField, Spinner, Table, type Selection } from "@heroui/react";
import { CalendarCheck, ChevronDown, LockKeyhole, Plus, Power, Save, Search, Trash2, UserPlus, X } from "lucide-react";

export interface SelectOption { disabled?: boolean; label: string; value: string; meta?: string; status?: string }

export function SearchableSelect({ label, value, options, placeholder = "Select", disabled, clearable = false, onChange }: { label?: string; value: string; options: SelectOption[]; placeholder?: string; disabled?: boolean; clearable?: boolean; onChange: (value: string) => void }) {
  const selected = options.find((option) => option.value === value);
  return (
    <div className="field-stack select-field">
      {label ? <span className="field-label">{label}</span> : null}
      <Autocomplete aria-label={label ?? placeholder} className="app-select" fullWidth selectedKey={value || null} onClear={() => onChange("")} onSelectionChange={(key: Key | null) => onChange(key?.toString() ?? "")} isDisabled={disabled}>
        <Autocomplete.Trigger aria-label={label ?? placeholder}>
          <Autocomplete.Value>{selected?.label ?? placeholder}</Autocomplete.Value>
          {clearable ? <Autocomplete.ClearButton type="button" /> : null}
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover className="app-select-popover">
          <Autocomplete.Filter>
            <SearchField className="app-select-search" aria-label={`Search ${label ?? "options"}`} autoFocus>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search options" />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
          </Autocomplete.Filter>
          <ListBox className="app-select-options" items={options} aria-label={label ?? placeholder}>
            {(option) => <ListBox.Item id={option.value} textValue={option.label}><span className="select-option"><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span></ListBox.Item>}
          </ListBox>
        </Autocomplete.Popover>
      </Autocomplete>
    </div>
  );
}

export function SearchableMultiSelect({ label, values, options, placeholder = "Select", disabled, onChange }: { label?: string; values: string[]; options: SelectOption[]; placeholder?: string; disabled?: boolean; onChange: (values: string[]) => void }) {
  const [query, setQuery] = useState("");
  const selectedKeys = useMemo(() => new Set(values), [values]);
  const enabledOptions = useMemo(() => options.filter((option) => !option.disabled), [options]);
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => `${option.label} ${option.meta ?? ""}`.toLowerCase().includes(normalized));
  }, [options, query]);
  const selectionLabel = values.length === 0 ? placeholder : values.length === enabledOptions.length ? `All available selected (${values.length})` : `${values.length} selected`;

  function handleSelectionChange(selection: Selection) {
    onChange(selection === "all" ? enabledOptions.map((option) => option.value) : Array.from(selection).map(String).filter((value) => enabledOptions.some((option) => option.value === value)));
  }

  return (
    <div className="field-stack select-field">
      {label ? <span className="field-label">{label}</span> : null}
      <Dropdown>
        <Button className="multi-select-trigger" type="button" variant="secondary" fullWidth isDisabled={disabled} aria-label={label ?? placeholder}>
          <span>{selectionLabel}</span>
          <ChevronDown size={16} />
        </Button>
        <Dropdown.Popover className="multi-select-popover" placement="bottom start">
          <SearchField className="multi-select-search" value={query} onChange={setQuery} aria-label={`Search ${label ?? "options"}`} autoFocus>
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Search options" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="multi-select-actions">
            <Button type="button" size="sm" variant="ghost" onPress={() => onChange(enabledOptions.map((option) => option.value))}>Select all</Button>
            <Button type="button" size="sm" variant="ghost" onPress={() => onChange([])}>Clear</Button>
          </div>
          <Dropdown.Menu selectedKeys={selectedKeys} selectionMode="multiple" shouldCloseOnSelect={false} onSelectionChange={handleSelectionChange} aria-label={label ?? placeholder} renderEmptyState={() => "No matching users"}>
            <Dropdown.Section>
              <Header>{filteredOptions.length} option{filteredOptions.length === 1 ? "" : "s"}</Header>
              {filteredOptions.map((option) => <Dropdown.Item key={option.value} id={option.value} textValue={option.label} isDisabled={option.disabled}><Dropdown.ItemIndicator /><Label><span className="multi-select-option"><span className="select-option"><strong>{option.label}</strong>{option.meta ? <small>{option.meta}</small> : null}</span>{option.status ? <Chip size="sm" color={option.status === "present" ? "success" : option.status === "absent" ? "danger" : option.status === "late" ? "warning" : "accent"} variant="soft">{option.status}</Chip> : null}</span></Label></Dropdown.Item>)}
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

export interface DataColumn<T> { header: string; render: (row: T) => ReactNode }

export function DataTable<T>({ rows, columns, rowKey, searchText, empty = "No records found." }: { rows: T[]; columns: DataColumn<T>[]; rowKey: (row: T) => string | number; searchText: (row: T) => string; empty?: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filtered = useMemo(() => rows.filter((row) => searchText(row).toLowerCase().includes(query.toLowerCase())), [query, rows, searchText]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const applySearch = () => { setQuery(input.trim()); setPage(1); };

  return (
    <Card className="data-card">
      <Card.Content>
        <div className="table-toolbar">
          <div className="table-search-wrap">
            <SearchField value={input} onChange={setInput} className="table-search" aria-label="Search records">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search records" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applySearch(); } }} />
                {input ? <SearchField.ClearButton onPress={() => { setInput(""); setQuery(""); setPage(1); }} /> : null}
              </SearchField.Group>
            </SearchField>
            <Button size="sm" variant="primary" type="button" onPress={applySearch}><Search size={15} />Search</Button>
          </div>
          <SearchableSelect value={String(pageSize)} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={[10, 25, 50].map((size) => ({ label: `${size} rows`, value: String(size) }))} />
        </div>
        <Table aria-label="Records">
          <Table.ScrollContainer>
            <Table.Content>
              <Table.Header>{columns.map((column, index) => <Table.Column key={column.header} isRowHeader={index === 0}>{column.header}</Table.Column>)}</Table.Header>
              <Table.Body>{visible.map((row) => <Table.Row id={String(rowKey(row))} key={rowKey(row)}>{columns.map((column) => <Table.Cell key={column.header}>{column.render(row)}</Table.Cell>)}</Table.Row>)}</Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
        {filtered.length === 0 ? <div className="empty-state">{empty}</div> : null}
        <Pagination className="pagination-bar" size="sm" aria-label="Pagination">
          <Pagination.Summary>{filtered.length ? `${(safePage - 1) * pageSize + 1}-${Math.min(safePage * pageSize, filtered.length)} of ${filtered.length}` : "0 records"}</Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item><Pagination.Previous type="button" isDisabled={safePage === 1} onPress={() => setPage((value) => Math.max(1, value - 1))}>Previous</Pagination.Previous></Pagination.Item>
            <Pagination.Item><Pagination.Link isActive type="button">{safePage} / {pages}</Pagination.Link></Pagination.Item>
            <Pagination.Item><Pagination.Next type="button" isDisabled={safePage === pages} onPress={() => setPage((value) => Math.min(pages, value + 1))}>Next</Pagination.Next></Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </Card.Content>
    </Card>
  );
}

function actionIcon(label: string, danger: boolean) {
  const action = label.toLowerCase();
  if (danger || action.includes("deactivate") || action.includes("delete")) return <Trash2 size={16} />;
  if (action.includes("attendance")) return <CalendarCheck size={16} />;
  if (action.includes("password")) return <LockKeyhole size={16} />;
  if (action.includes("onboard")) return <UserPlus size={16} />;
  if (action.includes("create") || action.includes("register") || action.includes("add")) return <Plus size={16} />;
  if (action.includes("enable") || action.includes("disable")) return <Power size={16} />;
  return <Save size={16} />;
}

function pendingLabel(label: string) {
  const action = label.toLowerCase();
  if (action.includes("create") || action.includes("register")) return "Creating...";
  if (action.includes("onboard")) return "Onboarding...";
  if (action.includes("deactivate") || action.includes("delete")) return "Deactivating...";
  if (action.includes("save")) return "Saving...";
  return "Updating...";
}

type ActionVariant = "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "danger-soft";

export function ConfirmAction({ label, title, description, danger = false, disabled, icon, variant, onConfirm }: { label: string; title: string; description: string; danger?: boolean; disabled?: boolean; icon?: ReactNode; variant?: ActionVariant; onConfirm: () => void | Promise<void> }) {
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const submissionLock = useRef(false);
  const resolvedIcon = icon ?? actionIcon(label, danger);
  const resolvedVariant = variant ?? (danger ? "danger" : "primary");

  async function submit(close: () => void) {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setIsSaving(true);
    setActionError("");
    try {
      await onConfirm();
      close();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to complete this action");
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialog.Trigger><Button type="button" size="sm" variant={resolvedVariant} isDisabled={disabled || isSaving}>{resolvedIcon}{label}</Button></AlertDialog.Trigger>
      <AlertDialog.Backdrop>
        <AlertDialog.Container placement="center">
          <AlertDialog.Dialog>
            {({ close }: { close: () => void }) => <>
              <AlertDialog.Header><AlertDialog.Heading>{title}</AlertDialog.Heading></AlertDialog.Header>
              <AlertDialog.Body><p>{description}</p>{actionError ? <Chip color="danger" variant="soft">{actionError}</Chip> : null}</AlertDialog.Body>
              <AlertDialog.Footer><Button type="button" variant="ghost" isDisabled={isSaving} onPress={close}><X size={16} />Cancel</Button><Button type="button" variant={resolvedVariant} isDisabled={isSaving} onPress={() => void submit(close)}>{isSaving ? <Spinner size="sm" /> : resolvedIcon}{isSaving ? pendingLabel(label) : "Confirm"}</Button></AlertDialog.Footer>
            </>}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-header"><div>{eyebrow ? <span>{eyebrow}</span> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="page-actions">{actions}</div> : null}</div>;
}

export function LoadingState() { return <Card className="state-card"><Card.Content><Spinner /><span>Loading data</span></Card.Content></Card>; }
export function Notice({ message, tone = "accent" }: { message: string; tone?: "accent" | "danger" | "success" | "warning" }) { return <Chip color={tone} variant="soft">{message}</Chip>; }
