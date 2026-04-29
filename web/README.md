# ipl-checklist-web

Next.js 15 (App Router) + Tailwind frontend for the IPL checklist demo.

## How it talks to the backend

- Browser → `/api/*` (same origin)
  - In dev, Next.js proxies `/api/*` to `API_URL` via `next.config.mjs` rewrites.
  - In production behind an ALB, the load balancer's path-based routing sends `/api/*` straight to the backend service before it reaches Next.js.
- Server-side (initial page render) → `${API_URL}/api/...` directly.

## Local dev

```bash
cp .env.example .env
npm install
npm run dev
```

Or run the whole stack from the repo root with `docker compose up --build`.

## Build

```bash
npm run build
npm start
```

The Dockerfile uses Next's `output: 'standalone'` mode, so the runtime image stays small.
