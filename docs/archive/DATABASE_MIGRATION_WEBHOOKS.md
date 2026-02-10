# Database Migration: Webhook and Transaction Models

## Migration Applied: `20251117101848_add_webhook_and_transaction_models`

This migration adds the database schema for production-ready webhook delivery and transaction management.

## Models Added

### 1. Webhook

Stores webhook configurations for tenants.

```prisma
model Webhook {
  id          String             @id @default(cuid())
  tenantId    String
  name        String
  url         String
  secret      String?            // HMAC secret
  events      String[]           // Event types to listen for
  enabled     Boolean            @default(true)
  maxRetries  Int                @default(5)
  timeout     Int                @default(10000)
  metadata    Json?
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  createdBy   String?
  deliveries  WebhookDelivery[]
}
```

**Purpose**: Configure webhooks for event notifications (contract.created, contract.processed, etc.)

### 2. WebhookDelivery

Tracks webhook delivery attempts and results.

```prisma
model WebhookDelivery {
  id          String   @id @default(cuid())
  webhookId   String
  tenantId    String
  event       String
  payload     Json
  status      String   @default("pending")
  attempt     Int      @default(1)
  maxAttempts Int      @default(5)
  statusCode  Int?
  response    String?
  error       String?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Purpose**: Audit trail of all webhook deliveries with retry tracking

### 3. IdempotencyKey

Prevents duplicate operations using idempotency keys.

```prisma
model IdempotencyKey {
  id           String   @id @default(cuid())
  key          String   @unique
  tenantId     String
  requestHash  String
  response     Json?
  statusCode   Int?
  createdAt    DateTime @default(now())
  expiresAt    DateTime
}
```

**Purpose**: Ensure operations like file uploads are idempotent (24-hour expiry)

### 4. OutboxEvent

Implements transactional outbox pattern for reliable event publishing.

```prisma
model OutboxEvent {
  id          String   @id @default(cuid())
  tenantId    String
  eventType   String
  aggregateId String
  payload     Json
  status      String   @default("pending")
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  error       String?
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

**Purpose**: Ensures events are published reliably even if external systems are temporarily unavailable

## How to Apply

### Development

```bash
cd packages/clients/db
npx prisma migrate dev
```

### Production

```bash
cd packages/clients/db
npx prisma migrate deploy
```

## Usage Examples

### Configure a Webhook

```typescript
await prisma.webhook.create({
  data: {
    tenantId: 'demo',
    name: 'Production Notifications',
    url: 'https://api.example.com/webhooks/contracts',
    secret: 'your-webhook-secret',
    events: ['contract.created', 'contract.processed'],
    enabled: true,
    maxRetries: 5,
  },
});
```

### Create Idempotency Key

```typescript
await prisma.idempotencyKey.create({
  data: {
    key: 'upload-abc123',
    tenantId: 'demo',
    requestHash: hashRequestBody(request),
    response: { success: true, contractId: '...' },
    statusCode: 200,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
});
```

### Create Outbox Event

```typescript
await prisma.outboxEvent.create({
  data: {
    tenantId: 'demo',
    eventType: 'CONTRACT_CREATED',
    aggregateId: contractId,
    payload: { contractId, fileName, status },
    status: 'pending',
  },
});
```

## Indexes

All models include appropriate indexes for performance:

- Tenant isolation (`tenantId`)
- Status queries (`status`, `enabled`)
- Time-based queries (`createdAt`, `expiresAt`)
- Event filtering (`eventType`, `events`)

## Cleanup

Idempotency keys expire after 24 hours. Set up a cron job to clean up:

```typescript
await prisma.idempotencyKey.deleteMany({
  where: {
    expiresAt: { lt: new Date() },
  },
});
```

## Integration

These models are used by:

- **Webhook Worker** (`packages/workers/src/webhook-worker.ts`)
- **Webhook Triggers** (`apps/web/lib/webhook-triggers.ts`)
- **Transaction Service** (`apps/web/lib/transaction-service.ts`)
- **Upload Route** (`apps/web/app/api/contracts/upload/route.ts`)

## Rollback

If needed, rollback with:

```bash
cd packages/clients/db
npx prisma migrate resolve --rolled-back 20251117101848_add_webhook_and_transaction_models
```

Then remove the models from `schema.prisma` and create a new migration.
