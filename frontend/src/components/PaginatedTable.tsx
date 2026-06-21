import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button, Pagination, SearchField, Table } from "@heroui/react";
import { SearchableSelect } from "./SearchableSelect";

export interface PaginatedTableColumn<T> {
  className?: string;
  header: string;
  render: (row: T) => ReactNode;
}

interface PaginatedTableProps<T> {
  columns: PaginatedTableColumn<T>[];
  emptyMessage?: string;
  getSearchText?: (row: T) => string;
  getRowKey: (row: T) => string | number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  rows: T[];
  searchPlaceholder?: string;
  searchable?: boolean;
}

export function PaginatedTable<T>({
  columns,
  emptyMessage = "No records found.",
  getSearchText,
  getRowKey,
  initialPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  rows,
  searchPlaceholder = "Search table",
  searchable = true
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputId = useId();
  const normalizedSearchTerm = searchTerm.toLowerCase();

  const filteredRows = useMemo(() => {
    if (!searchable || !normalizedSearchTerm) return rows;

    return rows.filter((row) => {
      const searchText = getSearchText ? getSearchText(row) : Object.values(row as Record<string, unknown>).join(" ");
      return searchText.toLowerCase().includes(normalizedSearchTerm);
    });
  }, [getSearchText, normalizedSearchTerm, rows, searchable]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedRows = useMemo(() => filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize), [filteredRows, pageSize, safePage]);

  function handlePageSizeChange(value: number) {
    setPageSize(value);
    setPage(1);
  }

  function applySearch() {
    setSearchTerm(searchInput.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
    setPage(1);
  }

  return (
    <div className="data-table">
      <div className="table-toolbar">
        {searchable ? (
          <div className="table-search" data-ignore-dirty="true">
            <label htmlFor={searchInputId}>Search</label>
            <SearchField className="table-search-control" value={searchInput} onChange={setSearchInput}>
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input
                id={searchInputId}
                placeholder={searchPlaceholder}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applySearch();
                  }
                }}
                />
              {searchTerm ? (
                <Button className="table-clear-button" variant="ghost" size="sm" isIconOnly type="button" onClick={clearSearch} aria-label="Clear search">
                  Clear
                </Button>
              ) : null}
              <Button className="table-search-button" variant="primary" size="sm" type="button" onClick={applySearch}>
                Search
              </Button>
              </SearchField.Group>
            </SearchField>
          </div>
        ) : null}
        <div className="table-toolbar-actions">
          <SearchableSelect
            label="Rows"
            value={String(pageSize)}
            onChange={(value) => handlePageSizeChange(Number(value))}
            options={pageSizeOptions.map((option) => ({ label: String(option), value: String(option) }))}
          />
        </div>
      </div>
      <Table className="hero-data-table" aria-label="Data table">
        <Table.ScrollContainer>
          <Table.Content>
            <Table.Header>
              {columns.map((column, index) => (
                <Table.Column className={column.className} isRowHeader={index === 0} key={column.header}>
                  {column.header}
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body>
              {pagedRows.map((row) => (
                <Table.Row id={String(getRowKey(row))} key={getRowKey(row)}>
                  {columns.map((column) => (
                    <Table.Cell className={column.className} key={column.header}>
                      {column.render(row)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {filteredRows.length === 0 ? <div className="empty-state compact">{rows.length === 0 ? emptyMessage : "No matching records found."}</div> : null}
      <Pagination className="pagination-bar" size="sm" aria-label="Table pagination">
        <Pagination.Summary>
          Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRows.length)} of{" "}
          {filteredRows.length}
        </Pagination.Summary>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous type="button" onPress={() => setPage((current) => Math.max(1, current - 1))} isDisabled={safePage === 1}>
            Previous
            </Pagination.Previous>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Link isActive type="button">
            Page {safePage} of {totalPages}
            </Pagination.Link>
          </Pagination.Item>
          <Pagination.Item>
            <Pagination.Next type="button" onPress={() => setPage((current) => Math.min(totalPages, current + 1))} isDisabled={safePage === totalPages}>
            Next
            </Pagination.Next>
          </Pagination.Item>
        </Pagination.Content>
      </Pagination>
    </div>
  );
}
