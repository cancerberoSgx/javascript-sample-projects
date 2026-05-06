import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  open: boolean;
  defaultFilename: string;
  onSave: (path: string) => void;
  onCancel: () => void;
}

const LAST_DIR_KEY = 'csv_last_dir';

function buildDefaultPath(filename: string): string {
  const lastDir = localStorage.getItem(LAST_DIR_KEY) ?? '';
  return lastDir ? `${lastDir}/${filename}` : '';
}

function rememberDir(filePath: string): void {
  const slash = filePath.lastIndexOf('/');
  if (slash > 0) localStorage.setItem(LAST_DIR_KEY, filePath.slice(0, slash));
}

export function SaveCsvDialog({ open, defaultFilename, onSave, onCancel }: Props) {
  const [path, setPath] = useState('');

  useEffect(() => {
    if (open) setPath(buildDefaultPath(defaultFilename));
  }, [open, defaultFilename]);

  function handleSave() {
    const trimmed = path.trim();
    if (!trimmed) return;
    rememberDir(trimmed);
    onSave(trimmed);
  }

  const trimmed = path.trim();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save CSV file</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="csv-save-path" className="text-xs">Absolute file path</Label>
          <Input
            id="csv-save-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={`/home/user/${defaultFilename}`}
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={!trimmed} onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
