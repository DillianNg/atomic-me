-- Phase 5: them gia tri 'PENDING' vao enum AssetStatus.
-- Postgres yeu cau ADD VALUE phai commit truoc khi co the dung lam default;
-- vi vay phan SET DEFAULT duoc tach sang migration tiep theo
-- (20260528000001_asset_default_pending).

-- AlterEnum
ALTER TYPE "AssetStatus" ADD VALUE 'PENDING' BEFORE 'UPLOADED';
