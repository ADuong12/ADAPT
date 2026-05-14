FROM node:22-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY server/package.json server/package-lock.json ./
RUN npm ci && npm prune --production

FROM node:22-slim AS runtime

WORKDIR /app

COPY --from=builder /build/node_modules ./server/node_modules
COPY server/src ./server/src
COPY server/package.json ./server/
COPY scripts ./scripts
COPY ["Knowledge Bases", "./Knowledge Bases"]
COPY adapt-database.sql .

RUN mkdir -p /app/data/uploads

COPY server/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000

VOLUME ["/app/data"]

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server/src/server.js"]
