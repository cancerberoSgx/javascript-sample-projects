import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/store';
import { useCreateConnection, useUpdateConnection } from '@/hooks/useConnections';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  db_host: z.string().min(1, 'Required'),
  db_port: z.number().int().min(1, 'Must be 1–65535').max(65535, 'Must be 1–65535'),
  db_name: z.string().min(1, 'Required'),
  db_user: z.string().min(1, 'Required'),
  db_password: z.string(),
});

type FormValues = z.infer<typeof schema>;

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ConnectionForm() {
  const view = useAppStore((s) => s.view);
  const resetView = useAppStore((s) => s.resetView);
  const createConnection = useCreateConnection();
  const updateConnection = useUpdateConnection();

  const isEdit = view.type === 'edit-connection';

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: isEdit
      ? {
          name: view.connection.name,
          db_host: view.connection.db_host,
          db_port: view.connection.db_port,
          db_name: view.connection.db_name,
          db_user: view.connection.db_user,
          db_password: view.connection.db_password,
        }
      : {
          name: '',
          db_host: 'localhost',
          db_port: 5432,
          db_name: '',
          db_user: '',
          db_password: '',
        },
  });

  function onSubmit(values: FormValues) {
    if (view.type === 'new-connection') {
      createConnection.mutate(
        { profileId: view.profileId, input: values },
        { onSuccess: resetView },
      );
    } else if (view.type === 'edit-connection') {
      updateConnection.mutate(
        { id: view.connection.id, profileId: view.connection.profile_id, input: values },
        { onSuccess: resetView },
      );
    }
  }

  const isPending = createConnection.isPending || updateConnection.isPending;

  return (
    <div className="flex h-full items-start justify-center pt-12 px-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Edit Connection' : 'New Connection'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEdit ? 'Update connection details.' : 'Add a new database connection.'}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field id="name" label="Connection name" error={errors.name?.message}>
            <Input id="name" placeholder="Production DB" {...register('name')} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field id="db_host" label="Host" error={errors.db_host?.message}>
                <Input id="db_host" placeholder="localhost" {...register('db_host')} />
              </Field>
            </div>
            <Field id="db_port" label="Port" error={errors.db_port?.message}>
              <Input id="db_port" type="number" placeholder="5432" {...register('db_port', { valueAsNumber: true })} />
            </Field>
          </div>

          <Field id="db_name" label="Database" error={errors.db_name?.message}>
            <Input id="db_name" placeholder="mydb" {...register('db_name')} />
          </Field>

          <Field id="db_user" label="User" error={errors.db_user?.message}>
            <Input id="db_user" placeholder="postgres" {...register('db_user')} />
          </Field>

          <Field id="db_password" label="Password" error={errors.db_password?.message}>
            <Input id="db_password" type="password" {...register('db_password')} />
          </Field>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving…' : 'Save Connection'}
            </Button>
            <Button type="button" variant="outline" onClick={resetView}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
