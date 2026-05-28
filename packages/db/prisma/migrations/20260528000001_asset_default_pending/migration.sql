-- Phase 5 (tiep theo): doi default cua Asset.status sang PENDING.
-- Phai o migration rieng vi 'PENDING' chi co the dung sau khi
-- ALTER TYPE ADD VALUE da commit (migration 20260528000000).

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "status" SET DEFAULT 'PENDING';
