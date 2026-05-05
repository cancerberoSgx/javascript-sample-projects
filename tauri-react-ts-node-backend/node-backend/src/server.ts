import express, { Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as crypto from 'crypto';

const SESSION_TOKEN = crypto.randomBytes(16).toString('hex');

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

const server = http.createServer(app);

// Port 0 lets the OS pick a free port
server.listen(0, '127.0.0.1', () => {
  const addr = server.address();
  if (!addr || typeof addr === 'string') {
    console.error('Failed to get server address');
    process.exit(1);
  }
  // console.log(addr);
  
  // Parent process reads this line to learn the port and session token
  console.log(`READY:${addr.port}:${SESSION_TOKEN}`);
});
