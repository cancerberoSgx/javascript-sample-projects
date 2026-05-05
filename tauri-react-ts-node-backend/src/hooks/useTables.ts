import { useQuery } from '@tanstack/react-query';
import { FilterClause, SortClause, tablesApi } from '@/lib/api';
import { useAppStore } from '@/store';

export function useTables(connectionId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['tables', connectionId],
    queryFn: () => tablesApi.list(connectionId, backendInfo!),
    enabled: !!backendInfo,
    retry: false,
  });
}

export function useTableFields(connectionId: number, tableName: string | null, schema?: string) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['table-fields', connectionId, schema, tableName],
    queryFn: () => tablesApi.getFields(connectionId, tableName!, schema, backendInfo!),
    enabled: !!backendInfo && tableName !== null,
    retry: false,
  });
}

export function useTableData(
  connectionId: number,
  tableName: string | null,
  schema: string | undefined,
  options: { filters?: FilterClause[]; sort?: SortClause; limit?: number; offset?: number } = {},
) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['table-data', connectionId, schema, tableName, options.sort, options.filters, options.limit, options.offset],
    queryFn: () => tablesApi.getData(connectionId, tableName!, { schema, ...options }, backendInfo!),
    enabled: !!backendInfo && tableName !== null,
    retry: false,
  });
}
