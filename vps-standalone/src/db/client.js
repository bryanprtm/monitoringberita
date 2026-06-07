import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL tidak diset. Salin .env.example ke .env dan isi.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function createListener(channel, onPayload) {
  const client = await pool.connect();
  await client.query(`LISTEN ${channel}`);
  client.on('notification', (msg) => {
    try {
      onPayload(msg.payload ? JSON.parse(msg.payload) : null);
    } catch (e) {
      console.error('LISTEN parse error', e);
    }
  });
  return () => client.release();
}

export async function notify(channel, payload) {
  await pool.query(`SELECT pg_notify($1, $2)`, [channel, JSON.stringify(payload)]);
}