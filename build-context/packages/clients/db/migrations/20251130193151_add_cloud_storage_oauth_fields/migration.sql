-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "account_email" TEXT,
ADD COLUMN     "account_name" TEXT,
ADD COLUMN     "connected_at" TIMESTAMP(3),
ADD COLUMN     "connected_by" TEXT,
ADD COLUMN     "refresh_token" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "token_expires_at" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'disconnected';
