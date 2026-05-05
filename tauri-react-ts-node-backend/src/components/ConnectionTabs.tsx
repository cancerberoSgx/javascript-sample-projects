import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, ChevronsUpDown, Loader2, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableData, useTableFields, useTables } from '@/hooks/useTables';
import { FilterClause, SortClause, TableInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { ConnectionForm } from './ConnectionForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFilterInputs(inputs: Record<string, string>): FilterClause[] {
  return Object.entries(inputs)
    .filter(([, v]) => v.trim().length > 0)
    .map(([col, raw]) => {
      const v = raw.trim();
      if (v.startsWith('>=')) return { column: col, op: 'gte' as const, value: v.slice(2).trim() };
      if (v.startsWith('<=')) return { column: col, op: 'lte' as const, value: v.slice(2).trim() };
      if (v.startsWith('>'))  return { column: col, op: 'gt'  as const, value: v.slice(1).trim() };
      if (v.startsWith('<'))  return { column: col, op: 'lt'  as const, value: v.slice(1).trim() };
      if (v.startsWith('='))  return { column: col, op: 'eq'  as const, value: v.slice(1).trim() };
      return { column: col, op: 'ilike' as const, value: `%${v}%` };
    });
}

function SortIcon({ column, sort }: { column: string; sort: SortClause | undefined }) {
  if (sort?.column !== column) return <ChevronsUpDown className="h-3 w-3 opacity-30 shrink-0" />;
  if (sort.direction === 'asc') return <ChevronUp className="h-3 w-3 shrink-0" />;
  return <ChevronDown className="h-3 w-3 shrink-0" />;
}

// ── Fields panel ─────────────────────────────────────────────────────────────

function FieldsPanel({
  connectionId,
  table,
}: {
  connectionId: number;
  table: Pick<TableInfo, 'name' | 'schema'>;
}) {
  const { data: fields, isLoading, error } = useTableFields(connectionId, table.name, table.schema);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error instanceof Error ? error.message : 'Failed to load fields'}
      </div>
    );
  }

  if (!fields?.length) {
    return <p className="p-4 text-sm text-muted-foreground">No fields found.</p>;
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-background z-10">
          <tr className="border-b">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Column</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nullable</th>
            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Default</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.name} className="border-b last:border-0 hover:bg-muted/40">
              <td className="px-4 py-2 font-mono flex items-center gap-2">
                {field.is_primary_key && (
                  <span className="text-[10px] font-sans font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-1">
                    PK
                  </span>
                )}
                {field.name}
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {field.native_type ?? field.data_type}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {field.nullable ? 'YES' : 'NO'}
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground text-xs">
                {field.default_value ?? <span className="opacity-40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Table data panel ──────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];

function TableDataPanel({
  connectionId,
  table,
}: {
  connectionId: number;
  table: Pick<TableInfo, 'name' | 'schema'>;
}) {
  const [sort, setSort] = useState<SortClause | undefined>();
  const [filterInputs, setFilterInputs] = useState<Record<string, string>>({});
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Debounce filter inputs by 400 ms
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedFilters(filterInputs);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [filterInputs]);

  const filters = useMemo(() => parseFilterInputs(appliedFilters), [appliedFilters]);

  const { data, isLoading, error } = useTableData(connectionId, table.name, table.schema, {
    filters,
    sort,
    limit: pageSize,
    offset: page * pageSize,
  });

  function handleSort(col: string) {
    setSort((prev) => {
      if (prev?.column !== col) return { column: col, direction: 'asc' };
      if (prev.direction === 'asc') return { column: col, direction: 'desc' };
      return undefined;
    });
    setPage(0);
  }

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {error instanceof Error ? error.message : 'Failed to load data'}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b">
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col}
                    <SortIcon column={col} sort={sort} />
                  </span>
                </th>
              ))}
            </tr>
            {columns.length > 0 && (
              <tr className="border-b bg-muted/20">
                {columns.map((col) => (
                  <td key={col} className="px-2 py-1">
                    <input
                      type="text"
                      value={filterInputs[col] ?? ''}
                      onChange={(e) =>
                        setFilterInputs((prev) => ({ ...prev, [col]: e.target.value }))
                      }
                      placeholder="filter…"
                      className="w-full text-xs bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 min-w-[70px]"
                    />
                  </td>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 font-mono text-xs whitespace-nowrap max-w-[280px] overflow-hidden text-ellipsis"
                  >
                    {row[col] === null || row[col] === undefined ? (
                      <span className="text-muted-foreground/40 italic not-italic">null</span>
                    ) : (
                      String(row[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-3 py-8 text-center text-muted-foreground text-sm"
                >
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="shrink-0 border-t px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {total.toLocaleString()} row{total !== 1 ? 's' : ''}
          {total > 0 && ` · page ${page + 1} / ${totalPages}`}
        </span>
        <div className="flex-1" />
        <select
          value={pageSize}
          onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
          className="bg-transparent border rounded px-1.5 py-0.5 cursor-pointer text-xs"
        >
          {PAGE_SIZES.map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          className="h-6 px-2 text-xs"
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
          className="h-6 px-2 text-xs"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ── Tables panel ──────────────────────────────────────────────────────────────

function TablesPanel({ connectionId }: { connectionId: number }) {
  const [selected, setSelected] = useState<Pick<TableInfo, 'name' | 'schema'> | null>(null);
  const { data: tables, isLoading, error } = useTables(connectionId);

  if (isLoading) {
    return (
      <div className="p-4 space-y-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-full rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-sm">Connection failed</p>
          <p className="text-sm mt-0.5 opacity-80">
            {error instanceof Error ? error.message : 'Could not reach database'}
          </p>
        </div>
      </div>
    );
  }

  if (!tables?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <Table2 className="h-8 w-8" />
        <p className="text-sm">No tables found</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Table list */}
      <div className="w-52 shrink-0 border-r overflow-auto">
        {tables.map((table) => {
          const key = `${table.schema}.${table.name}`;
          const isActive = selected?.name === table.name && selected?.schema === table.schema;
          return (
            <button
              key={key}
              onClick={() => setSelected({ name: table.name, schema: table.schema })}
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-muted/60 transition-colors',
                isActive && 'bg-muted font-medium',
              )}
            >
              <Table2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{table.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right panel — nested Fields / Data tabs */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <Tabs
            key={`${selected.schema}.${selected.name}`}
            defaultValue="fields"
            className="flex flex-col h-full gap-0"
          >
            <div className="border-b px-4 shrink-0">
              <TabsList variant="line" className="h-auto -mb-px gap-0 rounded-none bg-transparent p-0">
                <TabsTrigger value="fields" className="rounded-none px-0 pb-2 mr-4 text-xs">
                  Fields
                </TabsTrigger>
                <TabsTrigger value="data" className="rounded-none px-0 pb-2 text-xs">
                  Data
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="fields" className="flex-1 overflow-hidden mt-0">
              <FieldsPanel connectionId={connectionId} table={selected} />
            </TabsContent>
            <TabsContent value="data" className="flex-1 overflow-hidden mt-0">
              <TableDataPanel connectionId={connectionId} table={selected} />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a table to inspect
          </div>
        )}
      </div>
    </div>
  );
}

// ── ConnectionTabs ────────────────────────────────────────────────────────────

export function ConnectionTabs() {
  const view = useAppStore((s) => s.view);

  if (view.type !== 'edit-connection') return null;

  const { connection } = view;

  return (
    <Tabs defaultValue="config" className="flex flex-col h-full gap-0">
      {/* Header + tab nav */}
      <div className="border-b px-6 pt-4 shrink-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {connection.type}
        </p>
        <h2 className="text-base font-semibold mt-0.5 mb-3">{connection.name}</h2>
        <TabsList variant="line" className="h-auto -mb-px gap-0 rounded-none bg-transparent p-0">
          <TabsTrigger value="config" className="rounded-none px-0 pb-3 mr-5 text-sm">
            Config
          </TabsTrigger>
          <TabsTrigger value="tables" className="rounded-none px-0 pb-3 text-sm">
            Tables
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="config" className="flex-1 overflow-auto mt-0">
        <ConnectionForm />
      </TabsContent>

      <TabsContent value="tables" className="flex-1 overflow-hidden mt-0">
        <TablesPanel connectionId={connection.id} />
      </TabsContent>
    </Tabs>
  );
}
