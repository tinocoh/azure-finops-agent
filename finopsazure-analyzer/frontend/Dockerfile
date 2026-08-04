# ── Stage 1: build the Vite SPA ──
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
# VITE_API_BASE_URL is baked at build time; empty => same-origin (nginx proxy).
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ── Stage 2: serve with nginx ──
FROM nginx:1.27-alpine AS final
# The official image runs envsubst on *.template files at startup, substituting
# only variables present in the environment (BACKEND_URL). nginx runtime vars
# like $host/$uri are left untouched because they are not env vars.
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Default backend target for docker-compose; overridden in Azure Container Apps.
ENV BACKEND_URL=http://backend:8000
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
