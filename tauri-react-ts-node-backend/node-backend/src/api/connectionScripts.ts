import { Router, Request, Response } from 'express';
import {
  createScript,
  deleteScript,
  listScripts,
  ScriptInput,
  updateScript,
} from '../repository/scriptRepository';

const router = Router();

router.get('/:connectionId/scripts', (req: Request, res: Response): void => {
  const connectionId = parseId(req.params.connectionId);
  if (connectionId === null) { res.status(400).json({ error: 'Invalid connectionId' }); return; }

  res.json(listScripts(connectionId));
});

router.post('/:connectionId/scripts', (req: Request, res: Response): void => {
  const connectionId = parseId(req.params.connectionId);
  if (connectionId === null) { res.status(400).json({ error: 'Invalid connectionId' }); return; }

  const input = parseInput(req.body);
  if (!input) { res.status(400).json({ error: 'name and content are required' }); return; }

  res.status(201).json(createScript(connectionId, input));
});

router.put('/:connectionId/scripts/:id', (req: Request, res: Response): void => {
  const connectionId = parseId(req.params.connectionId);
  const id = parseId(req.params.id);
  if (connectionId === null || id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  const input = parseInput(req.body);
  if (!input) { res.status(400).json({ error: 'name and content are required' }); return; }

  const updated = updateScript(id, connectionId, input);
  if (!updated) { res.status(404).json({ error: 'Script not found' }); return; }

  res.json(updated);
});

router.delete('/:connectionId/scripts/:id', (req: Request, res: Response): void => {
  const connectionId = parseId(req.params.connectionId);
  const id = parseId(req.params.id);
  if (connectionId === null || id === null) { res.status(400).json({ error: 'Invalid id' }); return; }

  if (!deleteScript(id, connectionId)) { res.status(404).json({ error: 'Script not found' }); return; }

  res.status(204).send();
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInput(body: Record<string, unknown>): ScriptInput | null {
  const { name, content } = body;
  if (typeof name !== 'string' || !name.trim()) return null;
  if (typeof content !== 'string') return null;
  return { name: name.trim(), content };
}

export default router;
