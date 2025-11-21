/*
  Warnings:

  - Added the required column `aggregateType` to the `outbox_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProcessingJob" ADD COLUMN     "queueId" TEXT;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN     "aggregateType" TEXT NOT NULL;
