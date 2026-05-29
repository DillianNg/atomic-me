-- Phase 7: them cac field tracking extraction vao Asset + Atom.
-- - Asset.extractionCostUsd: tong cost USD (1 hoac nhieu chunk Claude).
-- - Asset.extractedAt: timestamp khi worker chuyen status -> COMPLETED.
-- - Asset.atomCount: so atom da luu (gom ca low confidence).
-- - Atom.promptVersion: phien ban prompt da sinh ra atom (semver string).
-- Tat ca nullable hoac co default -> row cu khong bi anh huong.

ALTER TABLE "Asset" ADD COLUMN "extractionCostUsd" DOUBLE PRECISION;
ALTER TABLE "Asset" ADD COLUMN "extractedAt" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "atomCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Atom" ADD COLUMN "promptVersion" TEXT;
