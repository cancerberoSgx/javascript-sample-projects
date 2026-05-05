import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as crypto from 'crypto';
import { initDb } from './db';
import profilesRouter from './api/profiles';
import connectionsRouter from './api/connections';
import connectionTablesRouter from './api/connectionTables';

const SESSION_TOKEN = crypto.randomBytes(16).toString('hex');

initDb();

const app = express();

// CORS must come before auth so OPTIONS preflights are answered without a token
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'x-session-token, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers['x-session-token'] !== SESSION_TOKEN) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true });
});

app.use('/api/profiles', profilesRouter);
app.use('/api/profiles/:profileId/connections', connectionsRouter);
app.use('/api/connections', connectionTablesRouter);

const server = http.createServer(app);

// PORT env var pins the port for browser dev (avoids updating the URL on every restart).
// Omit it (or set to 0) to let the OS pick a free port — used by the Tauri launcher.
const listenPort = Number(process.env.PORT ?? 0);

server.listen(listenPort, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    console.error('Failed to get server address');
    process.exit(1);
  }
  // stdout: Tauri's Rust side reads this line to learn the port and token
  console.log(`READY:${addr.port}:${SESSION_TOKEN}`);
  // stderr: developer hint — visible in the terminal but ignored by the Rust parser
  console.error(`[server] Browser dev URL: http://localhost:1420?port=${addr.port}&token=${SESSION_TOKEN}`);
});
