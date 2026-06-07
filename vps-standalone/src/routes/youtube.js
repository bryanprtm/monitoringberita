import { z } from 'zod';
import { pool } from '../db/client.js';
import { requireAuth } from '../lib/auth.js';

const schema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  category: z.string().min(1).max(40),
});

export default async function ytRoutes(app) {
  app.get('/api/youtube-sources', async () => {
    const r = await pool.query(
      `SELECT id, name, url, category, created_by
         FROM youtube_sources ORDER BY created_at ASC`
    );
    return r.rows;
  });

  app.post('/api/youtube-sources', { preHandler: requireAuth }, async (req) => {
    const body = schema.parse(req.body);
    const r = await pool.query(
      `INSERT INTO youtube_sources(name, url, category, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [body.name, body.url, body.category, req.user.id]
    );
    return r.rows[0];
  });

  app.patch('/api/youtube-sources/:id', { preHandler: requireAuth }, async (req, reply) => {
    const body = schema.parse(req.body);
    const r = await pool.query(
      `UPDATE youtube_sources SET name=$1, url=$2, category=$3, updated_at=now()
        WHERE id=$4 AND (created_by=$5 OR $6='admin') RETURNING *`,
      [body.name, body.url, body.category, req.params.id, req.user.id, req.user.role]
    );
    if (!r.rowCount) return reply.code(403).send({ error: 'Not allowed' });
    return r.rows[0];
  });

  app.delete('/api/youtube-sources/:id', { preHandler: requireAuth }, async (req, reply) => {
    const r = await pool.query(
      `DELETE FROM youtube_sources
        WHERE id=$1 AND (created_by=$2 OR $3='admin') RETURNING id`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!r.rowCount) return reply.code(403).send({ error: 'Not allowed' });
    return { ok: true };
  });
}