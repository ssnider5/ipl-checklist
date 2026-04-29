# ipl-checklist-server

Express + TypeScript + Postgres backend for the IPL checklist demo.

## Endpoints

All under `/api`:

- `GET  /api/health` — DB ping
- `GET  /api/plans` — list plans
- `GET  /api/plans/:id` — plan with tasks
- `POST /api/plans/:id/tasks/:taskId/start` — enforces prereqs
- `POST /api/plans/:id/tasks/:taskId/complete`
- `POST /api/plans/:id/tasks/:taskId/fail`
- `GET  /api/plans/:id/stream` — SSE stream of task updates

`GET /health` (without `/api`) is also exposed for the ECS/ALB target group health check.

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```

Or just run the whole stack from the repo root:

```bash
docker compose up --build
```

## Build

```bash
npm run build
npm start
```
