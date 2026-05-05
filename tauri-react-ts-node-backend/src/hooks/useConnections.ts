import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { connectionsApi, ConnectionInput } from '@/lib/api';
import { useAppStore } from '@/store';

export function useConnections(profileId: number) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['connections', profileId],
    queryFn: () => connectionsApi.list(profileId, backendInfo!),
    enabled: !!backendInfo,
  });
}

export function useCreateConnection() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profileId, input }: { profileId: number; input: ConnectionInput }) =>
      connectionsApi.create(profileId, input, backendInfo!),
    onSuccess: (_data, { profileId }) =>
      queryClient.invalidateQueries({ queryKey: ['connections', profileId] }),
  });
}

export function useUpdateConnection() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      profileId,
      input,
    }: {
      id: number;
      profileId: number;
      input: ConnectionInput;
    }) => connectionsApi.update(id, profileId, input, backendInfo!),
    onSuccess: (_data, { profileId }) =>
      queryClient.invalidateQueries({ queryKey: ['connections', profileId] }),
  });
}
