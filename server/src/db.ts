import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';

const useSsl = process.env.PGSSL === 'true';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error', err);
});

export async function runMigrations() {
  const sqlPath = path.join(__dirname, '..', 'migrations', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('[pg] migrations applied');
}
