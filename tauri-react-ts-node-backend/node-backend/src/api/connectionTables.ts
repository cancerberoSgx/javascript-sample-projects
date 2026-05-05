import { Router, Request, Response } from 'express';
import { getConnection } from '../repository/connectionRepository';
import { getConnector } from '../connectors';

const router = Router();

router.get('/:connectionId/tables', async (req: Request, res: Response): Promise<void> => {
  const connectionId = parseId(req.params.connectionId);
  if (connectionId === null) {
    res.status(400).json({ error: 'Invalid connectionId' });
    return;
  }

  const conn = getConnection(connectionId);
  if (!conn) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }

  try {
    const tables = await getConnector(conn).getTables();
    res.json(tables);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to list tables' });
  }
});

router.get('/:connectionId/tables/:tableName/fields', async (req: Request, res: Response): Promise<void> => {
  const connectionId = parseId(req.params.connectionId);
  if (connectionId === null) {
    res.status(400).json({ error: 'Invalid connectionId' });
    return;
  }

  const conn = getConnection(connectionId);
  if (!conn) {
    res.status(404).json({ error: 'Connection not found' });
    return;
  }

  const { tableName } = req.params;
  const schema = typeof req.query.schema === 'string' ? req.query.schema : undefined;

  try {
    const fields = await getConnector(conn).getTableFields(tableName, schema);
    res.json(fields);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to list fields' });
  }
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default router;
