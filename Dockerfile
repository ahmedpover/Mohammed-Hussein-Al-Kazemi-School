FROM node:22-alpine AS build
WORKDIR /app
COPY project/package.json project/package-lock.json ./
RUN npm ci
COPY project/ ./
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
