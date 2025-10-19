# UX Quick Wins Database Migration

## Overview

This migration adds 6 new tables to support the UX Quick Wins feature:

1. **UserPreferences** - Store user settings, role, goals, and dashboard layouts
2. **OnboardingAnalytics** - Track onboarding progress and user interactions
3. **ProgressEvent** - Store real-time progress updates for long-running jobs
4. **BackgroundJob** - Track background operations and their status
5. **HelpAnalytics** - Track help content usage and tour completions
6. **WidgetAnalytics** - Track dashboard widget usage and interactions

## Migration Files

- `007_ux_quick_wins_schema.sql` - SQL migration script
- `../schema.prisma` - Updated Prisma schema with new models
- `../scripts/run-ux-migration.sh` - Migration execution script
- `../scripts/verify-ux-schema.ts` - Schema verification script

## Running the Migration

### Option 1: Using the Shell Script (Recommended)

```bash
cd packages/clients/db
chmod +x scripts/run-ux-migration.sh
./scripts/run-ux-migration.sh
```

### Option 2: Manual SQL Execution

```bash
# Set your database URL
export DATABASE_URL="postgresql://user:password@localhost:5432/chainiq"

# Run the migration
psql $DATABASE_URL -f migrations/007_ux_quick_wins_schema.sql

# Generate Prisma client
npx prisma generate
```

### Option 3: Using Prisma Migrate (Development)

```bash
# Create a new migration from schema changes
npx prisma migrate dev --name ux_quick_wins

# Apply the migration
npx prisma migrate deploy
```

## Verifying the Migration

After running the migration, verify it was successful:

```bash
# Run the verification script
npx ts-node scripts/verify-ux-schema.ts
```

Expected output:
```
🔍 Verifying UX Quick Wins Schema...

📊 Tables Found:
  ✅ BackgroundJob
  ✅ HelpAnalytics
  ✅ OnboardingAnalytics
  ✅ ProgressEvent
  ✅ UserPreferences
  ✅ WidgetAnalytics

📇 Checking Indexes...
  BackgroundJob: 4 indexes
  HelpAnalytics: 5 indexes
  OnboardingAnalytics: 4 indexes
  ProgressEvent: 3 indexes
  UserPreferences: 2 indexes
  WidgetAnalytics: 4 indexes

🧪 Testing Basic Operations...
  ✅ UserPreferences: Schema validated
  ✅ ProgressEvent: Create/Delete successful

✅ Schema verification complete!
```

## Schema Details

### UserPreferences

Stores user-specific settings and preferences.

**Columns:**
- `id` - Primary key
- `userId` - Foreign key to User (unique)
- `role` - User role (procurement-manager, analyst, executive, etc.)
- `goals` - JSON array of user goals
- `dashboardLayout` - JSON object with dashboard configuration
- `theme` - UI theme (light/dark)
- `notifications` - JSON object with notification settings
- `onboardingState` - JSON object with current onboarding progress
- `onboardingCompleted` - Boolean flag
- `onboardingSkipped` - Boolean flag
- `onboardingCompletedAt` - Timestamp of completion
- `helpToursCompleted` - JSON array of completed tour IDs
- `customSettings` - JSON object for additional settings
- `createdAt`, `updatedAt` - Timestamps

**Indexes:**
- `userId` (unique)

**Relations:**
- One-to-one with User

### OnboardingAnalytics

Tracks user interactions during onboarding.

**Columns:**
- `id` - Primary key
- `userId` - Foreign key to User
- `stepId` - Onboarding step identifier
- `action` - Action taken (started, completed, skipped, back)
- `timeSpent` - Time spent on step (seconds)
- `metadata` - JSON object with additional data
- `timestamp` - When the action occurred

**Indexes:**
- `userId`
- `stepId`
- `timestamp`

**Relations:**
- Many-to-one with User

### ProgressEvent

Stores progress updates for long-running operations.

**Columns:**
- `id` - Primary key
- `jobId` - Job identifier
- `stage` - Current stage name
- `status` - Stage status (pending, in-progress, completed, failed)
- `progress` - Progress percentage (0-100)
- `details` - Human-readable status message
- `error` - Error message if failed
- `estimatedTime` - Estimated time remaining (seconds)
- `metadata` - JSON object with additional data
- `timestamp` - When the event occurred

**Indexes:**
- `jobId`
- `jobId, timestamp` (composite)

**Relations:**
- None (standalone events)

### BackgroundJob

Tracks background operations.

**Columns:**
- `id` - Primary key
- `userId` - Foreign key to User
- `type` - Job type
- `title` - Human-readable job title
- `status` - Job status (running, completed, failed)
- `progress` - Overall progress (0-100)
- `result` - JSON object with job result
- `error` - Error message if failed
- `startedAt` - When job started
- `completedAt` - When job completed
- `metadata` - JSON object with additional data

**Indexes:**
- `userId`
- `status`
- `userId, status` (composite)

**Relations:**
- Many-to-one with User

### HelpAnalytics

Tracks help system usage.

**Columns:**
- `id` - Primary key
- `userId` - Foreign key to User
- `tourId` - Tour identifier (if applicable)
- `stepId` - Tour step identifier (if applicable)
- `contentId` - Help content identifier (if applicable)
- `action` - Action taken (viewed, completed, searched, clicked)
- `query` - Search query (if action is search)
- `metadata` - JSON object with additional data
- `timestamp` - When the action occurred

**Indexes:**
- `userId`
- `tourId`
- `action`
- `timestamp`

**Relations:**
- Many-to-one with User

### WidgetAnalytics

Tracks dashboard widget usage.

**Columns:**
- `id` - Primary key
- `userId` - Foreign key to User
- `widgetType` - Widget type identifier
- `action` - Action taken (viewed, interacted, customized, removed)
- `duration` - Time spent (seconds)
- `metadata` - JSON object with additional data
- `timestamp` - When the action occurred

**Indexes:**
- `userId`
- `widgetType`
- `timestamp`

**Relations:**
- Many-to-one with User

## Rollback

If you need to rollback this migration:

```sql
-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS "WidgetAnalytics";
DROP TABLE IF EXISTS "HelpAnalytics";
DROP TABLE IF EXISTS "BackgroundJob";
DROP TABLE IF EXISTS "ProgressEvent";
DROP TABLE IF EXISTS "OnboardingAnalytics";
DROP TABLE IF EXISTS "UserPreferences";
```

## Next Steps

After running this migration:

1. ✅ Verify the schema with `verify-ux-schema.ts`
2. ✅ Generate Prisma client: `npx prisma generate`
3. ✅ Update your application code to use the new models
4. ✅ Implement the API endpoints for user preferences
5. ✅ Implement the onboarding flow
6. ✅ Implement progress tracking
7. ✅ Implement help analytics

## Troubleshooting

### Migration fails with "relation already exists"

The tables may already exist. Check with:

```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%Preferences%' OR tablename LIKE '%Analytics%';
```

If tables exist, you can either:
1. Drop them and re-run the migration
2. Skip this migration if it was already applied

### Foreign key constraint fails

Ensure the User table exists before running this migration:

```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'User';
```

### Prisma client generation fails

Make sure you're in the correct directory and the schema file is valid:

```bash
cd packages/clients/db
npx prisma validate
npx prisma generate
```

## Support

For issues or questions:
1. Check the verification script output
2. Review the Prisma schema for syntax errors
3. Ensure DATABASE_URL is correctly set
4. Check PostgreSQL logs for detailed error messages

---

**Migration Version**: 007
**Created**: 2025-01-18
**Status**: Ready for deployment
