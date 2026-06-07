import 'dotenv/config';
import { pool } from './client.js';
import { hashPassword } from '../lib/auth.js';

const DEFAULT_FEEDS = [
  { slug: 'detik',  name: 'Detik',  url: 'https://rss.detik.com/index.php/detikcom',     category: 'NAT' },
  { slug: 'kompas', name: 'Kompas', url: 'https://www.kompas.com/rss',                    category: 'NAT' },
  { slug: 'antara', name: 'Antara', url: 'https://www.antaranews.com/rss/terkini.xml',    category: 'NAT' },
];

async function run() {
  const email = 'admin@ncc.local';
  const u = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
  if (!u.rowCount) {
    const hash = await hashPassword('admin123');
    const r = await pool.query(
      `INSERT INTO users(email, password_hash, role) VALUES ($1,$2,'admin') RETURNING id`,
      [email, hash]
    );
    await pool.query(
      `INSERT INTO profiles(id, username, display_name) VALUES ($1,'admin','Admin')`,
      [r.rows[0].id]
    );
    console.log('Admin dibuat: username=admin password=admin123 (GANTI SEGERA)');
  }

  for (const f of DEFAULT_FEEDS) {
    await pool.query(
      `INSERT INTO rss_sources(slug,name,url,category,is_default)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (slug) DO NOTHING`,
      [f.slug, f.name, f.url, f.category]
    );
  }
  await pool.end();
  console.log('Seed done.');
}
run().catch((e) => { console.error(e); process.exit(1); });