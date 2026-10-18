# syntax=docker/dockerfile:1
# Build from the repository root so the workspace lockfile is available:
#   docker build -f frontend/Dockerfile -t gym-frontend .

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --workspace frontend
COPY frontend ./frontend
RUN npm run build --workspace frontend

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
# Backend origin that nginx proxies /api to (no trailing slash).
ENV API_URL=http://gym-app:3000
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
