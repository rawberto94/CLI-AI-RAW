-- The UserGroup model gained `departmentAccess` and `contractAccessLevel` after
-- 20260122122211_add_user_management_features created the table, but no migration
-- ever added them (local dev used `prisma db push`, production uses migrations).
-- Result: every query selecting these columns 500s in production
-- ("column user_groups.departmentAccess does not exist").
ALTER TABLE "user_groups"
  ADD COLUMN IF NOT EXISTS "contractAccessLevel" TEXT NOT NULL DEFAULT 'assigned';

ALTER TABLE "user_groups"
  ADD COLUMN IF NOT EXISTS "departmentAccess" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
