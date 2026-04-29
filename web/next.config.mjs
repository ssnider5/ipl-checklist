/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // /api/* is handled by the runtime proxy at app/api/[...path]/route.ts which
  // reads process.env.API_URL at request time. In production behind an ALB,
  // /api/* is intercepted by path-based routing before it ever reaches Next.js.
};

export default nextConfig;
