# Database Migrations Guide

## Overview

This guide explains how to manage database migrations for the Contract Intelligence Platform. The system uses Prisma as the ORM and migration tool, with PostgreSQL as the database.

---

## Table of Contents

1. [Migration System Overview](#migration-system-overview)
2. [Migration Process](#migration-process)
3. [Running Migrations](#running-migrations)
4. [Creating New Migrations](#creating-new-migrations)
5. [Rollback Procedures](#rollback-procedures)
6. [Migration Best Practices](#migration-best-practices)
7. [Troubleshooting](#troubleshooting)
8. [Migration History](#migration-history)

---

## Migration System Overview

### Technology Stack

- **ORM**: Prisma
- **Database**: PostgreSQL 16 with pgvector extension
- **Migration Tool**: Prisma Migrate
- **Schema Location**: `packages/clients/db/schema.prisma`
- **Migrations Directory**: `packages/clients/db/migrations/`

### Migration Types

The system uses two types of migrations:

1. **Prisma Migrations** (Recommended)
   - Generated from schema.prisma changes
   - Tracked in `migrations/` directory
   - Automatic rollback support
   - Version controlled

2. **SQL Migrations** (Manual)
   - Direct SQL files for complex operations
   - Located in `migrations/` directory
   - Numbered sequentially (e.g., `001_enhanced_schema.sql`)
   - Manual execution required

---

## Migration Process

### Development Workflow

```text
┌─────────────────┐
│ Update Schema   │
│ (schema.prisma) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Migration│
│ (prisma migrate)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Review SQL      │
│ (check changes) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Test Locally    │
│ (dev database)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Commit Changes  │
│ (git commit)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Deploy to Prod  │
│ (migrate deploy)│
└─────────────────┘
```

### Production Deployment Workflow

```text
┌─────────────────┐
│ Backup Database │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Test on Staging │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Schedule Window │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Run Migration   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verify Success  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Monitor System  │
└─────────────────┘
```

---

## Running Migrations

### Prerequisites

```bash
# Install dependencies
cd packages/clients/db
pnpm install

# Ensure DATABASE_URL is set
echo $DATABASE_URL
# Should output: postgresql://user:pass@host:port/database
```

### Development Environment

```bash
# Navigate to database package
cd packages/clients/db

# Run all pending migrations
npx prisma migrate dev

# This will:
# 1. Apply pending migrations
# 2. Generate Prisma Client
# 3. Update database schema
```

### Staging Environment

```bash
# Set staging database URL
export DATABASE_URL="postgresql://user:pass@staging-host:5432/contract_intelligence"

# Run migrations (no client generation)
npx prisma migrate deploy

# Verify migration status
npx prisma migrate status
```

### Production Environment

```bash
# IMPORTANT: Always backup first!
pg_dump -h prod-host -U postgres -d contract_intelligence \
  -F c -b -v -f "backup_$(date +%Y%m%d_%H%M%S).dump"

# Set production database URL
export DATABASE_URL="postgresql://user:pass@prod-host:5432/contract_intelligence"

# Check migration status
npx prisma migrate status

# Run migrations
npx prisma migrate deploy

# Verify success
npx prisma migrate status

# Generate Prisma Client (if needed)
npx prisma generate
```

### Docker Deployment

```bash
# Migrations run automatically on container start
# Or run manually:
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy

# Check status
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate status
```

---

## Creating New Migrations

### Using Prisma Migrate (Recommended)

#### 1. Update Schema

Edit `packages/clients/db/schema.prisma`:

```prisma
model NewFeature {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([name])
}
```

#### 2. Create Migration

```bash
cd packages/clients/db

# Create migration with descriptive name
npx prisma migrate dev --name add_new_feature

# This will:
# 1. Generate SQL migration file
# 2. Apply migration to dev database
# 3. Update Prisma Client
```

#### 3. Review Generated SQL

```bash
# Check the generated migration
cat migrations/YYYYMMDDHHMMSS_add_new_feature/migration.sql
```

Example output:

```sql
-- CreateTable
CREATE TABLE \"NewFeature\" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewFeature_name_idx" ON "NewFeature"("name");
```

#### 4. Test Migration

```bash
# Reset database and reapply all migrations
npx prisma migrate reset

# Or test on fresh database
createdb test_migration
export DATABASE_URL="postgresql://localhost:5432/test_migration"
npx prisma migrate deploy
```

### Manual SQL Migrations

For complex operations not supported by Prisma:

#### 1. Create SQL File

```bash
cd packages/clients/db/migrations

# Create numbered SQL file
touch 025_custom_migration.sql
```

#### 2. Write SQL

```sql
-- 025_custom_migration.sql
-- Description: Add custom indexes for performance

BEGIN;

-- Add custom index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contract_search 
ON "Contract" USING gin(to_tsvector('english', title || ' ' || description));

-- Add custom function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

COMMIT;
```

#### 3. Apply Manually

```bash
# Apply to development
psql $DATABASE_URL -f migrations/025_custom_migration.sql

# Verify
psql $DATABASE_URL -c "\d+ Contract"
```

---

## Rollback Procedures

### Automatic Rollback (Prisma Migrations)

Prisma doesn't support automatic rollback, but you can:

#### Option 1: Restore from Backup

```bash
# Stop application
docker compose -f docker-compose.prod.yml stop api workers

# Drop current database
dropdb contract_intelligence

# Create new database
createdb contract_intelligence

# Restore from backup
pg_restore -h localhost -U postgres -d contract_intelligence \
  -v backups/backup_YYYYMMDD_HHMMSS.dump

# Restart application
docker compose -f docker-compose.prod.yml start api workers
```

#### Option 2: Create Reverse Migration

```bash
# Create new migration that reverses changes
cd packages/clients/db

# Edit schema.prisma to remove changes
# Then create migration
npx prisma migrate dev --name rollback_feature_x

# Review and apply
npx prisma migrate deploy
```

### Manual Rollback (SQL Migrations)

#### 1. Create Rollback SQL

For each migration, create a corresponding rollback:

```sql
-- 025_custom_migration_rollback.sql
-- Rollback for: 025_custom_migration.sql

BEGIN;

-- Drop custom function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop custom index
DROP INDEX CONCURRENTLY IF EXISTS idx_contract_search;

COMMIT;
```

#### 2. Apply Rollback

```bash
# Apply rollback
psql $DATABASE_URL -f migrations/025_custom_migration_rollback.sql

# Verify
psql $DATABASE_URL -c "\d+ Contract"
```

### Emergency Rollback Procedure

```bash
# 1. Stop all services immediately
docker compose -f docker-compose.prod.yml stop

# 2. Restore database from last known good backup
pg_restore -h localhost -U postgres -d contract_intelligence \
  --clean --if-exists -v backups/last_good_backup.dump

# 3. Checkout previous application version
git checkout v1.9.0

# 4. Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 5. Verify system health
curl http://localhost:3000/api/health
```

---

## Migration Best Practices

### Planning

1. **Review Schema Changes**
   - Understand impact on existing data
   - Identify breaking changes
   - Plan for data migration if needed

2. **Test Thoroughly**
   - Test on development database
   - Test on staging with production-like data
   - Test rollback procedures

3. **Schedule Appropriately**
   - Choose low-traffic windows
   - Avoid Fridays and holidays
   - Allow adequate time for verification

### Execution

1. **Always Backup First**

   ```bash
   pg_dump -F c -b -v -f backup.dump $DATABASE_URL
   ```

2. **Use Transactions**

   ```sql
   BEGIN;
   -- migration statements
   COMMIT;
   ```

3. **Add Indexes Concurrently**

   ```sql
   CREATE INDEX CONCURRENTLY idx_name ON table(column);
   ```

4. **Avoid Locking Operations**
   - Use `ADD COLUMN` with default values carefully
   - Avoid `ALTER TYPE` on large tables
   - Consider multi-step migrations for large changes

### Data Safety

1. **Preserve Data**
   - Never drop columns without backup
   - Use `ALTER TABLE ... RENAME COLUMN` instead of drop/add
   - Archive old data before deletion

2. **Validate Data**

   ```sql
   -- Check for null values before adding NOT NULL
   SELECT COUNT(*) FROM table WHERE column IS NULL;
   
   -- Validate foreign keys
   SELECT COUNT(*) FROM child 
   WHERE parent_id NOT IN (SELECT id FROM parent);
   ```

3. **Handle Large Tables**

   ```sql
   -- Add column without default (fast)
   ALTER TABLE large_table ADD COLUMN new_col TEXT;
   
   -- Update in batches
   UPDATE large_table SET new_col = 'value' 
   WHERE id IN (SELECT id FROM large_table LIMIT 10000);
   ```

### Documentation

1. **Comment Migrations**

   ```sql
   -- Migration: Add user preferences
   -- Date: 2025-10-30
   -- Author: Roberto Ostojic
   -- Ticket: PROJ-123
   -- Description: Adds user preferences table for customization
   ```

2. **Update Migration History**
   - Document in this file
   - Update CHANGELOG.md
   - Note breaking changes

3. **Create Rollback Scripts**
   - Always create rollback SQL
   - Test rollback procedures
   - Document rollback steps

---

## Troubleshooting

### Issue: Migration Fails with "relation already exists"

**Cause**: Migration was partially applied

**Solution**:

```bash
# Check migration status
npx prisma migrate status

# Mark migration as applied (if it actually was)
npx prisma migrate resolve --applied MIGRATION_NAME

# Or rollback and retry
# Restore from backup, then rerun
```

### Issue: "Migration is in a failed state"

**Cause**: Migration failed mid-execution

**Solution**:

```bash
# Check what failed
npx prisma migrate status

# Resolve as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Fix the migration SQL
# Then retry
npx prisma migrate deploy
```

### Issue: Slow Migration on Large Tables

**Cause**: Locking operations on large tables

**Solution**:

```sql
-- Instead of:
ALTER TABLE large_table ADD COLUMN new_col TEXT DEFAULT 'value';

-- Do:
-- Step 1: Add column without default
ALTER TABLE large_table ADD COLUMN new_col TEXT;

-- Step 2: Update in batches (outside transaction)
DO $$
DECLARE
  batch_size INT := 10000;
  offset_val INT := 0;
BEGIN
  LOOP
    UPDATE large_table 
    SET new_col = 'value'
    WHERE id IN (
      SELECT id FROM large_table 
      WHERE new_col IS NULL 
      LIMIT batch_size
    );
    
    EXIT WHEN NOT FOUND;
    offset_val := offset_val + batch_size;
    RAISE NOTICE 'Updated % rows', offset_val;
  END LOOP;
END $$;

-- Step 3: Add default for future rows
ALTER TABLE large_table ALTER COLUMN new_col SET DEFAULT 'value';
```

### Issue: Foreign Key Constraint Violation

**Cause**: Orphaned records or invalid references

**Solution**:

```sql
-- Find orphaned records
SELECT c.id, c.parent_id 
FROM child c 
LEFT JOIN parent p ON c.parent_id = p.id 
WHERE p.id IS NULL;

-- Clean up orphaned records
DELETE FROM child 
WHERE parent_id NOT IN (SELECT id FROM parent);

-- Then retry migration
```

### Issue: Out of Disk Space

**Cause**: Large table operations require temporary space

**Solution**:

```bash
# Check disk space
df -h

# Clean up old backups
rm -f backups/old_backup_*.dump

# Vacuum database to reclaim space
psql $DATABASE_URL -c "VACUUM FULL;"

# Or increase disk space before migration
```

---

## Migration History

### Current Schema Version

**Version**: 2.0.0  
**Last Migration**: 024_add_optimistic_locking.sql  
**Date**: 2025-10-30

### Major Migrations

| Migration | Date | Description | Breaking Changes |
|-----------|------|-------------|------------------|
| 024_add_optimistic_locking.sql | 2025-10-30 | Added version column for optimistic locking | None |
| 023_add_client_baseline_negotiation.sql | 2025-10-25 | Added client, baseline, and negotiation tables | None |
| 022_performance_indexes.sql | 2025-10-20 | Added performance indexes | None |
| 021_multi_currency_advanced.sql | 2025-10-15 | Enhanced multi-currency support | None |
| 020_alerts_and_reporting.sql | 2025-10-10 | Added alerting and reporting | None |
| 019_supplier_intelligence.sql | 2025-10-05 | Added supplier intelligence | None |
| 018_clustering_models.sql | 2025-10-01 | Added clustering support | None |
| 017_outlier_detection.sql | 2025-09-25 | Added outlier detection | None |
| 016_rate_forecasts.sql | 2025-09-20 | Added rate forecasting | None |
| 015_rate_card_performance_indexes.sql | 2025-09-15 | Performance optimization | None |
| 014_role_standardization.sql | 2025-09-10 | Standardized role taxonomy | None |
| 013_editable_artifacts.sql | 2025-09-05 | Made artifacts editable | None |
| 010_fulltext_search.sql | 2025-08-30 | Added full-text search | None |
| 009_performance_indexes_critical.sql | 2025-08-25 | Critical performance indexes | None |
| 008_add_performance_indexes.sql | 2025-08-20 | Initial performance indexes | None |

### Upcoming Migrations

- Multi-tenant isolation enhancements
- Advanced caching layer
- Audit trail improvements

---

## Database Extensions

The system requires the following PostgreSQL extensions:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- For pgvector
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy search
```

These are automatically enabled by the init script: `init/01-enable-extensions.sql`

---

## Performance Considerations

### Index Strategy

1. **Primary Keys**: Automatic B-tree indexes
2. **Foreign Keys**: Indexed for join performance
3. **Search Fields**: GIN indexes for full-text search
4. **Timestamp Fields**: B-tree indexes for range queries
5. **Composite Indexes**: For common query patterns

### Query Optimization

```sql
-- Check slow queries
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Analyze table statistics
ANALYZE Contract;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;
```

### Maintenance

```bash
# Regular maintenance (weekly)
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Reindex (monthly)
psql $DATABASE_URL -c "REINDEX DATABASE contract_intelligence;"

# Update statistics (after large data changes)
psql $DATABASE_URL -c "ANALYZE;"
```

---

## Additional Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Migration Best Practices](https://www.postgresql.org/docs/current/ddl-alter.html)
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Environment Variables](./ENVIRONMENT_VARIABLES.md)
- [Database Schema](../../../packages/clients/db/schema.prisma)
