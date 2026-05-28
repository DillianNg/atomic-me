-- Phase 5: them trang thai PENDING vao AssetStatus va doi default Asset.status sang PENDING.
-- Postgres 12+ cho phep ADD VALUE trong cung mot transaction (project chay Postgres 16).

-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'PENDING' BEFORE 'UPLOADED';

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'PENDING';
