#!/usr/bin/env node
/**
 * Import data dari Supabase ke PostgreSQL self-hosted.
 * Lihat MIGRATION.md untuk langkah lengkap.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { pool } from '../src/db/client.js';
import { hashPassword } from '../src/lib/auth.js';

const [usersCsv, dataSqlFile] = process.argv.slice(2);
if (!usersCsv) {
  console.error('Usage: node scripts/import-from-supabase.js <users.csv> [<data.sql>]');
  process.exit(1);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

async function importUsers() {
  const csv = await readFile(usersCsv, 'utf8');
  const lines = csv.trim().split('\n').slice(1);
  const tempHash = await hashPassword('changeme123');
  let n = 0;
  for (const line of lines) {
    const [id, email] = parseCsvLine(line);
    if (!id || !email) continue;
    await pool.query(
      `INSERT INTO users(id, email, password_hash, role)
       VALUES ($1,$2,$3,'user')
       ON CONFLICT (id) DO NOTHING`,
      [id, email, tempHash]
    );
    n++;
  }
  console.log(`✓ ${n} users imported (password sementara: changeme123)`);
}

async function importData() {
  if (!dataSqlFile) return;
  console.log('Importing data.sql via psql ...');
  execSync(`psql "${process.env.DATABASE_URL}" -f "${dataSqlFile}"`, { stdio: 'inherit' });
  console.log('✓ Data imported');
}

async function run() {
  await importUsers();
  await importData();
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });