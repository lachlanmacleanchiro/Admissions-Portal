# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
# openssl is required by the Prisma schema engine (used by `prisma migrate deploy`)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# All dependencies, used only for building. npm's download cache is kept
# between builds, so a changed lockfile doesn't re-download everything.
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# Just the Prisma CLI (plus dotenv for prisma.config.ts), at the versions in
# the lockfile, so the running container can apply migrations on startup.
FROM base AS migrate-deps
WORKDIR /migrate
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
  PRISMA_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version") \
  && DOTENV_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version") \
  && rm package-lock.json \
  && npm init -y > /dev/null \
  && npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}"

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder so prisma.config.ts resolves during the build. The real value is
# supplied at runtime by docker-compose; nothing connects to it at build time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
# Next's build cache is kept between builds to speed up recompiling.
RUN --mount=type=cache,target=/app/.next/cache \
  npx prisma generate && npm run build && npm run build:scripts

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Next.js standalone server: only the files the app needs at runtime.
# It runs from /app, so uploads stay at /app/uploads (the mounted volume).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Database migrations (Prisma CLI + migration files), kept apart from the app.
COPY --from=migrate-deps --chown=node:node /migrate/node_modules ./migrate/node_modules
COPY --chown=node:node prisma.config.ts ./migrate/prisma.config.ts
COPY --chown=node:node prisma/schema.prisma ./migrate/prisma/schema.prisma
COPY --chown=node:node prisma/migrations ./migrate/prisma/migrations
# Bundled scripts, e.g. daily task reminders: `node dist/send-task-reminders.mjs`
COPY --from=builder --chown=node:node /app/dist ./dist
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
# Apply any pending migrations, then start the server
CMD ["sh", "-c", "cd /app/migrate && node node_modules/prisma/build/index.js migrate deploy && cd /app && exec node server.js"]
