# syntax=docker/dockerfile:1
# Stage 1: Build the Expo web app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.json app.json app.config.js App.tsx index.ts ./
COPY src/ src/
COPY assets/ assets/
COPY public/ public/

# Build-time env vars (overridable via --build-arg)
ARG EXPO_PUBLIC_API_URL=/api
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

RUN --mount=type=cache,target=/app/.expo npx expo export --platform web

# Remove source maps from production build
RUN find /app/dist -name '*.map' -delete 2>/dev/null || true

# Stage 2: Serve with nginx (non-root)
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Prepare directories for non-root nginx
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expo SPA build output
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Static content (HTML pages, robots.txt, ads.txt, etc.) in separate directory.
# Volume-mountable: override via docker-compose volume for instant HTML updates
# without requiring a full Docker rebuild.
RUN mkdir -p /static-content/guides && chown -R nginx:nginx /static-content
COPY --from=builder --chown=nginx:nginx /app/public /static-content

# Run as non-root user
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
