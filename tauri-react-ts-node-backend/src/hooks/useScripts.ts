import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Script, ScriptInput, scriptsApi } from '@/lib/api';
import { useAppStore } from '@/store';

export function useScripts(connectionId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['scripts', connectionId],
    queryFn: () => scriptsApi.list(connectionId, backendInfo!),
    enabled: !!backendInfo,
  });
}

export function useCreateScript(connectionId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScriptInput) => scriptsApi.create(connectionId, input, backendInfo!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts', connectionId] }),
  });
}

export function useUpdateScript(connectionId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ScriptInput }) =>
      scriptsApi.update(connectionId, id, input, backendInfo!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts', connectionId] }),
  });
}

export function useDeleteScript(connectionId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scriptsApi.delete(connectionId, id, backendInfo!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scripts', connectionId] }),
  });
}

export type { Script, ScriptInput };
