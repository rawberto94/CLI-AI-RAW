/*
  Warnings:

  - You are about to drop the column `embedding_vector` on the `Embedding` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Embedding_embedding_vector_idx";

-- AlterTable
ALTER TABLE "Embedding" DROP COLUMN "embedding_vector";
