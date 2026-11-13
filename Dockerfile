FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm run build:server

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/server/legacy ./server/legacy
COPY --from=build /app/server/schema.sql ./server/schema.sql
USER node
EXPOSE 3001
CMD ["node","server-dist/index.js"]

FROM caddy:2-alpine AS web
ENV SITE_ADDRESS=:80
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
