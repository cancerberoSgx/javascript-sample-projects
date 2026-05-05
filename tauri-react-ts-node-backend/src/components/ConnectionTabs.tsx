import { useState } from 'react';
import { AlertCircle, Table2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableFields, useTables } from '@/hooks/useTables';
import { FieldInfo, TableInfo } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store';
import { ConnectionForm } from './ConnectionForm';

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
          {fields.map((field: FieldInfo) => (
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

      {/* Fields panel */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <FieldsPanel connectionId={connectionId} table={selected} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Select a table to inspect its fields
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
