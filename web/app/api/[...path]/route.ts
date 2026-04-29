import type { NextRequest } from 'next/server';

// Dynamic, never cached — every /api/* request hits the upstream backend.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handler(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;

  // Read API_URL on every request so it stays a pure runtime variable.
  const base = process.env.API_URL || 'http://localhost:4000';

  const upstreamUrl = new URL(`${base}/api/${(path ?? []).join('/')}`);
  upstreamUrl.search = req.nextUrl.search;

  // Forward request headers minus the ones that don't belong to the upstream hop.
  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    redirect: 'manual',
  };
  if (hasBody) {
    init.body = req.body;
    // Required by the fetch streams spec when sending a ReadableStream body.
    init.duplex = 'half';
  }

  const upstream = await fetch(upstreamUrl, init);

  // Strip hop-by-hop / transport-shaped response headers; let Next set its own.
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('content-length');
  respHeaders.delete('content-encoding');
  respHeaders.delete('transfer-encoding');
  respHeaders.delete('connection');

  // Passing upstream.body straight through preserves SSE streaming with no
  // buffering — the runtime forwards bytes as the backend emits them.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
  handler as OPTIONS,
};
