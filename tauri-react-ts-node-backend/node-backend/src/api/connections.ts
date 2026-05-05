import { Router, Request, Response } from 'express';
import {
  listConnections,
  createConnection,
  updateConnection,
  ConnectionInput,
} from '../repository/connectionRepository';

// mergeParams makes :profileId from the parent route available as req.params.profileId
const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response): void => {
  const profileId = parseId(req.params.profileId);
  if (profileId === null) { res.status(400).json({ error: 'Invalid profileId' }); return; }

  res.json(listConnections(profileId));
});

router.post('/', (req: Request, res: Response): void => {
  const profileId = parseId(req.params.profileId);
  if (profileId === null) { res.status(400).json({ error: 'Invalid profileId' }); return; }

  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'type, name, db_host, db_port, db_name, db_user, db_password are all required' });
    return;
  }

  res.status(201).json(createConnection(profileId, input));
});

router.put('/:id', (req: Request, res: Response): void => {
  const profileId = parseId(req.params.profileId);
  const id = parseId(req.params.id);
  if (profileId === null || id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'type, name, db_host, db_port, db_name, db_user, db_password are all required' });
    return;
  }

  const updated = updateConnection(id, profileId, input);
  if (!updated) { res.status(404).json({ error: 'Connection not found' }); return; }

  res.json(updated);
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInput(body: Record<string, unknown>): ConnectionInput | null {
  const { type, name, db_host, db_port, db_name, db_user, db_password } = body;

  if (
    typeof type !== 'string' || !type ||
    typeof name !== 'string' || !name ||
    typeof db_host !== 'string' || !db_host ||
    typeof db_port !== 'number' ||
    typeof db_name !== 'string' || !db_name ||
    typeof db_user !== 'string' || !db_user ||
    typeof db_password !== 'string'
  ) {
    return null;
  }

  return { type, name, db_host, db_port, db_name, db_user, db_password };
}

export default router;
