# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Remove devDependencies so runtime is smaller
RUN npm prune --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080 HOSTNAME=0.0.0.0
# Need runtime node_modules + built assets (no standalone server)
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public 2>/dev/null || true

# OpenShift-friendly non-root
RUN addgroup -g 0 -S root && adduser -S -G root -u 1001 nextjs \
 && chown -R 1001:0 /app && chmod -R g=u /app
USER 1001

EXPOSE 8080
# Use Next’s built-in server
CMD ["npm","run","start","--","-p","8080"]