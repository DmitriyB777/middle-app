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

# ---- Runtime stage: serve the static bundle with nginx ----
FROM nginx:1.29-alpine AS runtime

# Replace the default site config with SPA routing + /api reverse proxy.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ship only the compiled assets.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
