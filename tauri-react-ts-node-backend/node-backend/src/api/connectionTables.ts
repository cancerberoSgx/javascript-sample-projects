import { Router, Request, Response } from 'express';
import { getConnection } from '../repository/connectionRepository';
import { FilterClause, FilterOp, getConnector } from '../connectors';

const VALID_OPS = new Set<string>(['eq', 'lt', 'gt', 'lte', 'gte', 'like', 'ilike']);

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  if (typeof val === 'string') return [val];
  return [];
}

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

router.get('/:connectionId/tables/:tableName/data', async (req: Request, res: Response): Promise<void> => {
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
  const q = req.query;

  const schema = typeof q.schema === 'string' ? q.schema : undefined;

  const rawColumns = q.columns;
  let columns: string[] | undefined;
  if (Array.isArray(rawColumns)) {
    columns = rawColumns.filter((c): c is string => typeof c === 'string');
  } else if (typeof rawColumns === 'string') {
    columns = rawColumns.split(',').map((c) => c.trim()).filter(Boolean);
  }

  const sortCol = typeof q.sort_col === 'string' && q.sort_col ? q.sort_col : undefined;
  const sortDir: 'asc' | 'desc' = q.sort_dir === 'desc' ? 'desc' : 'asc';
  const sort = sortCol ? { column: sortCol, direction: sortDir } : undefined;

  const filterCols = toStringArray(q.filter_col);
  const filterOps  = toStringArray(q.filter_op);
  const filterVals = toStringArray(q.filter_val);
  const filters: FilterClause[] = [];
  for (let i = 0; i < filterCols.length; i++) {
    const op = filterOps[i] ?? 'eq';
    if (!VALID_OPS.has(op)) continue;
    filters.push({ column: filterCols[i], op: op as FilterOp, value: filterVals[i] ?? '' });
  }

  const limit  = Math.min(Math.max(Number(q.limit)  || 50, 1), 1000);
  const offset = Math.max(Number(q.offset) || 0, 0);

  try {
    const result = await getConnector(conn).getTableData(tableName, {
      schema, columns, filters, sort, limit, offset,
    });
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to query table data' });
  }
});

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default router;
