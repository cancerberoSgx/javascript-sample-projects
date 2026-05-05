import { useQuery } from '@tanstack/react-query';
import { tablesApi } from '@/lib/api';
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
