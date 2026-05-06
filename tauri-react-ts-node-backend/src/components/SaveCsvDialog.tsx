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

export function SaveCsvDialog({ open, defaultFilename, onSave, onCancel }: Props) {
  const [path, setPath] = useState('');

  useEffect(() => {
    if (open) setPath('');
  }, [open]);

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
            onKeyDown={(e) => e.key === 'Enter' && trimmed && onSave(trimmed)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" disabled={!trimmed} onClick={() => onSave(trimmed)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
