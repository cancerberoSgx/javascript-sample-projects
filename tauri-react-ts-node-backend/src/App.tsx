import { useEffect, useState } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ConnectionForm } from '@/components/ConnectionForm';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { getBackendInfo } from '@/lib/backend';
import { useAppStore } from '@/store';

function MainContent() {
  const view = useAppStore((s) => s.view);
  if (view.type === 'welcome') return <WelcomeScreen />;
  const key =
    view.type === 'new-connection'
      ? `new-${view.profileId}`
      : `edit-${view.connection.id}`;
  return <ConnectionForm key={key} />;
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <MainContent />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
