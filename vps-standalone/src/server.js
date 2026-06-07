import 'dotenv/config';
import path from 'node:path';
import { existsSync } from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import staticPlugin from '@fastify/static';

import authRoutes from './routes/auth.js';
import rssRoutes from './routes/rss.js';
import ytRoutes from './routes/youtube.js';
import { registerClient, startRealtime } from './ws/hub.js';

const app = Fastify({ logger: true, trustProxy: true });

await app.register(cookie);
await app.register(cors, { origin: true, credentials: true });
await app.register(websocket);

await app.register(authRoutes);
await app.register(rssRoutes);
await app.register(ytRoutes);

app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));

app.get('/api/ws', { websocket: true }, (socket) => {
  registerClient(socket);
  socket.send(JSON.stringify({ type: 'connected' }));
});

const dist = path.resolve(process.env.FRONTEND_DIST || './public');
if (existsSync(dist)) {
  await app.register(staticPlugin, { root: dist, prefix: '/' });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`FRONTEND_DIST tidak ditemukan di ${dist} — backend-only mode.`);
}

await startRealtime().catch((e) => app.log.error(e, 'realtime failed'));

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`✅ News CC backend ready on :${port}`);
});