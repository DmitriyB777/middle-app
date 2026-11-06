# syntax=docker/dockerfile:1

# ---- Build stage: compile the Vite/TypeScript app into static files ----
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies from the lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the remaining sources and produce /app/dist via `tsc -b && vite build`.
COPY . .
RUN npm run build

# ---- Runtime stage: serve the static bundle with nginx over HTTPS ----
FROM nginx:1.29-alpine AS runtime

# openssl is used by the startup script to generate a self-signed certificate
# for local development. /etc/nginx/certs is the mount point for real certs.
RUN apk add --no-cache openssl && mkdir -p /etc/nginx/certs

# Replace the default site config with the HTTP->HTTPS redirect, TLS server,
# SPA routing and the /api reverse proxy.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Generate a self-signed certificate on startup if none is mounted.
# The official nginx image executes every /docker-entrypoint.d/*.sh script
# before starting nginx, in lexicographic order.
COPY docker-entrypoint.d/10-generate-self-signed-cert.sh /docker-entrypoint.d/10-generate-self-signed-cert.sh
RUN chmod +x /docker-entrypoint.d/10-generate-self-signed-cert.sh

# Ship only the compiled assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443

# Check the plain-HTTP endpoint, which never redirects, so the probe stays valid.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
