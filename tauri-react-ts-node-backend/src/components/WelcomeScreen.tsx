import { Database } from 'lucide-react';

export function WelcomeScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-3">
        <Database className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="text-xl font-semibold">SQL Inspector</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Select a connection from the sidebar or create a new one.
        </p>
      </div>
    </div>
  );
}
