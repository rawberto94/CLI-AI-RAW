# --- Base build stage ---
FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Only copy lock + workspace manifests first for better caching
COPY pnpm-workspace.yaml package.json ../../package.json ./
COPY ../../pnpm-lock.yaml ./pnpm-lock.yaml

# Install workspace deps (pruned later)
RUN pnpm install --frozen-lockfile

# Copy full monorepo (context assumed at repo root when building)
# (In CI you may build with docker build -f apps/api/Dockerfile .)
COPY . .

# Build only required packages for api
RUN pnpm --filter utils build && pnpm --filter schemas build && pnpm --filter clients-* build || true
RUN pnpm --filter api build

# --- Production runtime image ---
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info

# Copy node_modules from build (production pruned)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/dist ./dist
COPY --from=base /app/apps/api/package.json ./package.json

# If Prisma is used, copy schema and generate client (placeholder)
# COPY --from=base /app/packages/clients/db/schema.prisma ./prisma/schema.prisma
# RUN npx prisma generate || true

EXPOSE 3001
CMD ["node", "dist/index.js"]
