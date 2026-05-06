import { useState } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToastItem, useToastStore } from '@/hooks/useToast';

function ToastEntry({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [open, setOpen] = useState(true);

  return (
    <Toast.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setTimeout(onRemove, 200);
      }}
      duration={4000}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3.5 shadow-lg',
        'bg-popover text-popover-foreground text-sm',
        'duration-150 outline-none',
        'data-open:animate-in data-open:slide-in-from-right-full data-open:fade-in-0',
        'data-closed:animate-out data-closed:slide-out-to-right-full data-closed:fade-out-0',
        toast.variant === 'success'
          ? 'border-green-200 dark:border-green-800'
          : 'border-destructive/50',
      )}
    >
      {toast.variant === 'success'
        ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
        : <XCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />}
      <div className="flex-1 min-w-0">
        <Toast.Title className="font-medium leading-snug">{toast.title}</Toast.Title>
        {toast.description && (
          <Toast.Description className="mt-0.5 text-xs text-muted-foreground break-all">
            {toast.description}
          </Toast.Description>
        )}
      </div>
      <Toast.Close asChild>
        <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
          <X className="h-3.5 w-3.5" />
        </button>
      </Toast.Close>
    </Toast.Root>
  );
}

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onRemove={() => remove(t.id)} />
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)] outline-none" />
    </Toast.Provider>
  );
}
