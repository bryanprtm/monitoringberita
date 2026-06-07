import { createListener } from '../db/client.js';

const clients = new Set();

export function registerClient(socket) {
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
}

function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const s of clients) {
    try { s.send(msg); } catch {}
  }
}

export async function startRealtime() {
  await createListener('rss_sources_changed', (p) =>
    broadcast({ table: 'rss_sources', ...p })
  );
  await createListener('youtube_sources_changed', (p) =>
    broadcast({ table: 'youtube_sources', ...p })
  );
  console.log('Realtime LISTEN aktif: rss_sources_changed, youtube_sources_changed');
}