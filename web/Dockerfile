# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage ---
FROM node:20-alpine AS runtime
WORKDIR /app
ARG API_URL=http://server:4000
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV API_URL=$API_URL

# Next.js standalone output: a self-contained server.js plus minimal node_modules
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000
CMD ["node", "server.js"]
