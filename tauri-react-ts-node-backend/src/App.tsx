import { useEffect, useState } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConnectionForm } from '@/components/ConnectionForm';
import { ConnectionTabs } from '@/components/ConnectionTabs';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { getBackendInfo } from '@/lib/backend';
import { useAppStore } from '@/store';

function MainContent() {
  const view = useAppStore((s) => s.view);
  if (view.type === 'welcome') return <WelcomeScreen />;
  if (view.type === 'new-connection') return <ConnectionForm key={`new-${view.profileId}`} />;
  return <ConnectionTabs key={`edit-${view.connection.id}`} />;
}

function App() {
  const setBackendInfo = useAppStore((s) => s.setBackendInfo);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBackendInfo()
      .then((info) => {
        setBackendInfo(info);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(String(e));
        setLoading(false);
      });
  }, [setBackendInfo]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        Connecting to backend…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive text-sm max-w-sm text-center">{error}</p>
      </div>
    );
  }

  return (
    <SidebarProvider className="h-full overflow-hidden">
      <AppSidebar />
      <SidebarInset className="min-h-0 overflow-hidden">
        <MainContent />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
