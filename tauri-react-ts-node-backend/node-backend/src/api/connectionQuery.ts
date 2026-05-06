import { Router, Request, Response } from 'express';
import { stringify } from 'csv-stringify';
import { getConnection } from '../repository/connectionRepository';
import { getConnector } from '../connectors';

const router = Router();

router.post('/:connectionId/query', async (req: Request, res: Response): Promise<void> => {
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

  const body = req.body as Record<string, unknown>;
  const { query, format } = body;
  if (typeof query !== 'string' || !query.trim()) {
    res.status(400).json({ error: '`query` must be a non-empty string' });
    return;
  }

  try {
    const result = await getConnector(conn).executeQuery(query);

    if (format === 'csv') {
      if (result.type !== 'select') {
        res.status(400).json({ error: 'CSV export is only available for SELECT queries' });
        return;
      }
      const columns = result.fields.map((f) => f.name);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="query_result.csv"');
      const stringifier = stringify({ header: true, columns });
      stringifier.pipe(res);
      for (const row of result.rows) {
        stringifier.write(row);
      }
      stringifier.end();
      return;
    }

    res.json(result);
  } catch (err) {
    // PostgreSQL (and most DB clients) attach a `severity` field to DB-level
    // errors (syntax errors, permission denied, undefined table, …).
    // Anything else is a connectivity / system failure.
    const isDbError = err instanceof Error && 'severity' in err;
    const message = err instanceof Error ? err.message : 'Query failed';
    res.status(isDbError ? 400 : 502).json({ error: message });
  }
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default router;
