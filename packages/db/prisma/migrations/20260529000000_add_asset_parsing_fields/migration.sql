-- Phase 6: them cac field parsing vao Asset.
-- parsedMetadata (JSON), parsedAt (timestamp), warnings (text[]).
-- Default cho warnings = '{}' (empty array) de row cu khong null.

ALTER TABLE "Asset" ADD COLUMN "parsedMetadata" JSONB;
ALTER TABLE "Asset" ADD COLUMN "parsedAt" TIMESTAMP(3);
ALTER TABLE "Asset" ADD COLUMN "warnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
