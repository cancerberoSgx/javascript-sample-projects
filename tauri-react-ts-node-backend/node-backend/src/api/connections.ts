import { Router, Request, Response } from 'express';
import {
  listConnections,
  createConnection,
  updateConnection,
  ConnectionInput,
} from '../repository/connectionRepository';

const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json(listConnections());
});

router.post('/', (req: Request, res: Response): void => {
  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'name, db_host, db_port, db_name, db_user, db_password are all required' });
    return;
  }
  res.status(201).json(createConnection(input));
});

router.put('/:id', (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  const input = parseInput(req.body);
  if (!input) {
    res.status(400).json({ error: 'name, db_host, db_port, db_name, db_user, db_password are all required' });
    return;
  }

  const updated = updateConnection(id, input);
  if (!updated) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }

  res.json(updated);
});

function parseInput(body: Record<string, unknown>): ConnectionInput | null {
  const { name, db_host, db_port, db_name, db_user, db_password } = body;

  if (
    typeof name !== 'string' || !name ||
    typeof db_host !== 'string' || !db_host ||
    typeof db_port !== 'number' ||
    typeof db_name !== 'string' || !db_name ||
    typeof db_user !== 'string' || !db_user ||
    typeof db_password !== 'string' || !db_password
  ) {
    return null;
  }

  return { name, db_host, db_port, db_name, db_user, db_password };
}

export default router;
