import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";

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
          <div
            className="table-search"
          >
            <label htmlFor="table-search-input">Search</label>
            <div className="table-search-control">
              <Search size={16} aria-hidden="true" />
              <input
                id="table-search-input"
                type="search"
                value={searchInput}
                placeholder={searchPlaceholder}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applySearch();
                  }
                }}
              />
              {searchTerm ? (
                <button className="table-clear-button" type="button" onClick={clearSearch} aria-label="Clear search" title="Clear search">
                  <X size={15} />
                </button>
              ) : null}
              <button className="table-search-button" type="submit">
                Search
              </button>
            </div>
          </div>
        ) : null}
        <div className="table-toolbar-actions">
          <label className="inline-filter">
            Rows
            <select value={pageSize} onChange={(event) => handlePageSizeChange(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.className} key={column.header}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td className={column.className} key={column.header}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{rows.length === 0 ? emptyMessage : "No matching records found."}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="pagination-bar">
        <span>
          Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, filteredRows.length)} of{" "}
          {filteredRows.length}
        </span>
        <div>
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage === 1}>
            Previous
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage === totalPages}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
