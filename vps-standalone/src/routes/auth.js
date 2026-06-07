import { z } from 'zod';
import { pool } from '../db/client.js';
import {
  hashPassword, verifyPassword, signToken,
  COOKIE_NAME, cookieOptions, requireAuth,
} from '../lib/auth.js';

const USERNAME_DOMAIN = 'ncc.local';
const usernameToEmail = (u) =>
  `${String(u).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')}@${USERNAME_DOMAIN}`;

const credSchema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(80).optional(),
});

export default async function authRoutes(app) {
  app.post('/api/auth/signup', async (req, reply) => {
    const body = credSchema.parse(req.body);
    const email = usernameToEmail(body.username);
    const hash = await hashPassword(body.password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const u = await client.query(
        'INSERT INTO users(email, password_hash) VALUES ($1,$2) RETURNING id, role',
        [email, hash]
      );
      const user = u.rows[0];
      await client.query(
        'INSERT INTO profiles(id, username, display_name) VALUES ($1,$2,$3)',
        [user.id, body.username.toLowerCase(), body.displayName || body.username]
      );
      await client.query('COMMIT');
      const token = await signToken({ sub: user.id, role: user.role, username: body.username });
      reply.setCookie(COOKIE_NAME, token, cookieOptions());
      return { id: user.id, username: body.username, role: user.role };
    } catch (e) {
      await client.query('ROLLBACK');
      if (e.code === '23505') return reply.code(409).send({ error: 'Username sudah dipakai' });
      throw e;
    } finally {
      client.release();
    }
  });

  app.post('/api/auth/signin', async (req, reply) => {
    const { username, password } = credSchema.pick({ username: true, password: true }).parse(req.body);
    const email = usernameToEmail(username);
    const r = await pool.query(
      `SELECT u.id, u.password_hash, u.role, p.username, p.display_name
         FROM users u LEFT JOIN profiles p ON p.id = u.id
        WHERE u.email = $1`,
      [email]
    );
    const row = r.rows[0];
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return reply.code(401).send({ error: 'Username atau password salah' });
    }
    const token = await signToken({ sub: row.id, role: row.role, username: row.username });
    reply.setCookie(COOKIE_NAME, token, cookieOptions());
    return { id: row.id, username: row.username, displayName: row.display_name, role: row.role };
  });

  app.post('/api/auth/signout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req) => {
    const r = await pool.query(
      `SELECT u.id, u.role, p.username, p.display_name
         FROM users u LEFT JOIN profiles p ON p.id = u.id
        WHERE u.id = $1`,
      [req.user.id]
    );
    return r.rows[0] || null;
  });
}