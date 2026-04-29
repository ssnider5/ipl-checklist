// On the server we read API_URL on every request so it stays a pure runtime
// variable — ECS task definition can override it without rebuilding the image.
// On the client we always use same-origin '/api/...' which Next.js rewrites
// (in dev / docker-compose) or the ALB intercepts (in prod).

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const isServer = typeof window === 'undefined';
  const url = isServer
    ? `${process.env.API_URL || 'http://localhost:4000'}${path}`
    : path;
  return fetch(url, { cache: 'no-store', ...init });
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error ?? `request failed: ${res.status}`);
    (err as Error & { status?: number; body?: unknown }).status = res.status;
    (err as Error & { status?: number; body?: unknown }).body = body;
    throw err;
  }
  return res.json() as Promise<T>;
}
