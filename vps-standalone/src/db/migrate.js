import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { pool } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIG_DIR = path.resolve(__dirname, '../../migrations');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function applied() {
  const r = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(r.rows.map((x) => x.filename));
}

async function run() {
  await ensureTable();
  const done = await applied();
  const files = (await readdir(MIG_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (done.has(f)) { console.log(`[skip] ${f}`); continue; }
    const sql = await readFile(path.join(MIG_DIR, f), 'utf8');
    console.log(`[apply] ${f}`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [f]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      console.error(`[fail] ${f}`, e.message);
      process.exit(1);
    }
  }
  await pool.end();
  console.log('Migrations done.');
}

run().catch((e) => { console.error(e); process.exit(1); });