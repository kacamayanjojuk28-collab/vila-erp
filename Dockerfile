FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build:build@127.0.0.1/build npx prisma generate
RUN DATABASE_URL=postgresql://build:build@127.0.0.1/build npm run build
FROM build AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
