import express from 'express';
import cors from 'cors';
import { api } from './routes';
import { runMigrations } from './db';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

// Mount everything under /api so the path matches what the ALB routes
// to this service in production (path-based routing on /api/*).
app.use('/api', api);

// Bare /health for ECS / ALB target group health checks
app.get('/health', (_req, res) => res.json({ ok: true }));

async function main() {
  // Retry briefly so we tolerate Postgres still booting in docker-compose
  for (let i = 0; i < 10; i++) {
    try {
      await runMigrations();
      break;
    } catch (err) {
      if (i === 9) throw err;
      console.log(`[pg] not ready yet (${(err as Error).message}), retrying...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(port, () => console.log(`[server] listening on :${port}`));
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
