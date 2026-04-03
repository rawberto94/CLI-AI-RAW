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

# Cache bust ARG - invalidates all subsequent layers when changed
ARG CACHE_BUST=default
RUN echo "Cache bust: ${CACHE_BUST}"

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
# Provide dummy environment variables for build-time only (ARG doesn't persist in image layers)
ARG DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
ARG OPENAI_API_KEY="sk-dummy-key-for-build"
ARG INTERNAL_API_SECRET="dummy-secret-for-build"
ARG NEXTAUTH_SECRET="dummy-nextauth-secret-for-build"
ARG JWT_SECRET="dummy-jwt-secret-for-build"
ARG REDIS_URL="redis://localhost:6379"
ARG NEXT_PUBLIC_APP_URL="https://localhost:3000"
ARG NEXTAUTH_URL="https://localhost:3000"
ARG APP_URL="https://localhost:3000"
ARG NEXT_PUBLIC_URL="https://localhost:3000"
ARG MINIO_ACCESS_KEY="dummy-minio-key"
ARG MINIO_SECRET_KEY="dummy-minio-secret"
ARG MINIO_ENDPOINT="localhost"
ARG MINIO_PORT="9000"
# Export ARGs as ENV for the build step only (not persisted in runner stage)
ENV DATABASE_URL=$DATABASE_URL OPENAI_API_KEY=$OPENAI_API_KEY INTERNAL_API_SECRET=$INTERNAL_API_SECRET \
    NEXTAUTH_SECRET=$NEXTAUTH_SECRET JWT_SECRET=$JWT_SECRET REDIS_URL=$REDIS_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXTAUTH_URL=$NEXTAUTH_URL APP_URL=$APP_URL \
    NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL MINIO_ACCESS_KEY=$MINIO_ACCESS_KEY MINIO_SECRET_KEY=$MINIO_SECRET_KEY \
    MINIO_ENDPOINT=$MINIO_ENDPOINT MINIO_PORT=$MINIO_PORT
RUN pnpm build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Install OpenSSL for Prisma runtime + tini for proper signal handling
RUN apk add --no-cache libc6-compat openssl openssl-dev tini

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Use 6GB heap for 8GB container (leaves 2GB for OS overhead)
ENV NODE_OPTIONS="--max-old-space-size=6144"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Copy data-orchestration dist (not traced by standalone output for dynamic imports)
COPY --from=builder --chown=nextjs:nodejs /app/packages/data-orchestration/dist ./packages/data-orchestration/dist

# Create uploads directory writable by nextjs user
RUN mkdir -p uploads/contracts uploads/chunks && chown -R nextjs:nodejs uploads

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
