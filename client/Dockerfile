FROM node:22-slim AS builder

WORKDIR /app

COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ .
RUN npm run build

FROM nginx:1.27-slim

COPY client/nginx.default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80