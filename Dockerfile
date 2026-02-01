# Multi-stage build for Next.js application
# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.9.0

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/clients/db/package.json ./packages/clients/db/
COPY packages/data-orchestration/package.json ./packages/data-orchestration/
COPY packages/utils/package.json ./packages/utils/
COPY packages/workers/package.json ./packages/workers/
COPY packages/agents/package.json ./packages/agents/
COPY packages/schemas/package.json ./packages/schemas/

# Install dependencies (using no-frozen-lockfile for monorepo compatibility)
RUN pnpm install --frozen-lockfile || pnpm install

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Install OpenSSL and other required libraries for Prisma
RUN apk add --no-cache libc6-compat openssl

# Install pnpm
RUN npm install -g pnpm@8.9.0

# Copy source code first
COPY . .

# Install all dependencies including devDependencies for Prisma
RUN pnpm install --frozen-lockfile || pnpm install

# Generate Prisma client
RUN pnpm --filter clients-db exec prisma generate

# Build packages that the web app depends on
RUN pnpm --filter @repo/data-orchestration build
RUN pnpm --filter clients-db build || true

# Build Next.js app with increased memory
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=8192"
# Provide dummy environment variables for build-time (needed for validation, won't connect)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ENV OPENAI_API_KEY="sk-dummy-key-for-build"
ENV INTERNAL_API_SECRET="dummy-secret-for-build"
RUN pnpm build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apk add --no-cache libc6-compat openssl openssl-dev

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
