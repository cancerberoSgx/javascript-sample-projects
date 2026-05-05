import { useState } from 'react';
import {
  ChevronRight,
  Database,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useConnections } from '@/hooks/useConnections';
import {
  useCreateProfile,
  useDeleteProfile,
  useProfiles,
  useUpdateProfile,
} from '@/hooks/useProfiles';
import { useAppStore } from '@/store';
import { Profile } from '@/lib/api';
import { ProfileDialog } from './ProfileDialog';

type ProfileDialogState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; profileId: number; name: string };

function ProfileConnections({ profile }: { profile: Profile }) {
  const { data: connections = [], isLoading } = useConnections(profile.id);
  const openNewConnection = useAppStore((s) => s.openNewConnection);
  const openEditConnection = useAppStore((s) => s.openEditConnection);

  if (isLoading) {
    return (
      <SidebarMenuSub>
        {[0, 1].map((i) => (
          <SidebarMenuSubItem key={i}>
            <Skeleton className="h-5 w-full rounded" />
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    );
  }

  return (
    <SidebarMenuSub>
      {connections.map((conn) => (
        <SidebarMenuSubItem key={conn.id}>
          <SidebarMenuSubButton onClick={() => openEditConnection(conn)}>
            <Database className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{conn.name}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          className="text-muted-foreground hover:text-foreground"
          onClick={() => openNewConnection(profile.id)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>Add connection</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  );
}

interface ProfileItemProps {
  profile: Profile;
  onEditProfile: () => void;
}

function ProfileItem({ profile, onEditProfile }: ProfileItemProps) {
  const { expandedProfileIds, toggleProfile } = useAppStore((s) => s);
  const deleteProfile = useDeleteProfile();
  const isExpanded = expandedProfileIds.includes(profile.id);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => toggleProfile(profile.id)}>
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-150',
            isExpanded && 'rotate-90',
          )}
        />
        <FolderOpen className="h-4 w-4 shrink-0" />
        <span className="truncate">{profile.name}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Profile actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-40">
          <DropdownMenuItem onClick={onEditProfile}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => deleteProfile.mutate(profile.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isExpanded && <ProfileConnections profile={profile} />}
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [profileDialog, setProfileDialog] = useState<ProfileDialogState>(null);
  const { data: profiles = [], isLoading } = useProfiles();
  const createProfile = useCreateProfile();
  const updateProfile = useUpdateProfile();

  function handleProfileSubmit(name: string) {
    if (!profileDialog) return;
    if (profileDialog.mode === 'create') {
      createProfile.mutate(name, { onSuccess: () => setProfileDialog(null) });
    } else {
      updateProfile.mutate(
        { id: profileDialog.profileId, name },
        { onSuccess: () => setProfileDialog(null) },
      );
    }
  }

  return (
    <>
      <Sidebar collapsible="none">
        <SidebarHeader className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <span className="font-semibold text-sm">SQL Inspector</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Profiles</SidebarGroupLabel>
            <SidebarGroupAction
              title="New profile"
              onClick={() => setProfileDialog({ mode: 'create' })}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New profile</span>
            </SidebarGroupAction>

            <SidebarGroupContent>
              {isLoading && (
                <div className="px-2 space-y-1">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-7 w-full rounded" />
                  ))}
                </div>
              )}

              {!isLoading && profiles.length === 0 && (
                <div className="px-2 py-3 text-xs text-muted-foreground">
                  No profiles yet.{' '}
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setProfileDialog({ mode: 'create' })}
                  >
                    Create one
                  </Button>
                </div>
              )}

              <SidebarMenu>
                {profiles.map((profile) => (
                  <ProfileItem
                    key={profile.id}
                    profile={profile}
                    onEditProfile={() =>
                      setProfileDialog({
                        mode: 'edit',
                        profileId: profile.id,
                        name: profile.name,
                      })
                    }
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <ProfileDialog
        open={profileDialog !== null}
        onOpenChange={(open) => { if (!open) setProfileDialog(null); }}
        title={profileDialog?.mode === 'edit' ? 'Edit Profile' : 'New Profile'}
        initialName={profileDialog?.mode === 'edit' ? profileDialog.name : ''}
        onSubmit={handleProfileSubmit}
        isLoading={createProfile.isPending || updateProfile.isPending}
      />
    </>
  );
}
