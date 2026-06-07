import { z } from 'zod';
import { pool } from '../db/client.js';
import { requireAuth } from '../lib/auth.js';

const insertSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  category: z.string().min(1).max(40),
});

export default async function rssRoutes(app) {
  app.get('/api/rss-sources', async () => {
    const r = await pool.query(
      `SELECT id, slug, name, url, category, is_default, created_by
         FROM rss_sources
        ORDER BY is_default DESC, created_at ASC`
    );
    return r.rows;
  });

  app.post('/api/rss-sources', { preHandler: requireAuth }, async (req) => {
    const body = insertSchema.parse(req.body);
    const slug = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const r = await pool.query(
      `INSERT INTO rss_sources(slug, name, url, category, is_default, created_by)
       VALUES ($1,$2,$3,$4,false,$5) RETURNING *`,
      [slug, body.name, body.url, body.category, req.user.id]
    );
    return r.rows[0];
  });

  app.delete('/api/rss-sources/:id', { preHandler: requireAuth }, async (req, reply) => {
    const r = await pool.query(
      `DELETE FROM rss_sources
        WHERE id = $1 AND (
          (created_by = $2 AND is_default = false) OR $3 = 'admin'
        ) RETURNING id`,
      [req.params.id, req.user.id, req.user.role]
    );
    if (!r.rowCount) return reply.code(403).send({ error: 'Not allowed' });
    return { ok: true };
  });
}