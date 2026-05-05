import { Router, Request, Response } from 'express';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
} from '../repository/profileRepository';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json(listProfiles());
});

router.get('/:id', (req: Request, res: Response): void => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  const profile = getProfile(id);
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }

  res.json(profile);
});

router.post('/', (req: Request, res: Response): void => {
  const name = parseName(req.body);
  if (name === null) { res.status(400).json({ error: 'name is required' }); return; }

  res.status(201).json(createProfile(name));
});

router.put('/:id', (req: Request, res: Response): void => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  const name = parseName(req.body);
  if (name === null) { res.status(400).json({ error: 'name is required' }); return; }

  const updated = updateProfile(id, name);
  if (!updated) { res.status(404).json({ error: 'Profile not found' }); return; }

  res.json(updated);
});

router.delete('/:id', (req: Request, res: Response): void => {
  const id = parseId(req.params.id);
  if (id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  if (!deleteProfile(id)) { res.status(404).json({ error: 'Profile not found' }); return; }

  res.status(204).send();
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseName(body: Record<string, unknown>): string | null {
  const { name } = body;
  if (typeof name !== 'string' || !name.trim()) return null;
  return name.trim();
}

export default router;
