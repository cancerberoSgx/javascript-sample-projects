import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '@/lib/api';
import { useAppStore } from '@/store';

export function useProfiles() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => profilesApi.list(backendInfo!),
    enabled: !!backendInfo,
  });
}

export function useCreateProfile() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => profilesApi.create(name, backendInfo!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useUpdateProfile() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      profilesApi.update(id, name, backendInfo!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profiles'] }),
  });
}

export function useDeleteProfile() {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const queryClient = useQueryClient();
  const resetView = useAppStore((s) => s.resetView);
  return useMutation({
    mutationFn: (id: number) => profilesApi.delete(id, backendInfo!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      resetView();
    },
  });
}
