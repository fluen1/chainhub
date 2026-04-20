-- Add content_hash column and index to DocumentExtraction
ALTER TABLE "DocumentExtraction" ADD COLUMN "content_hash" VARCHAR(64);
CREATE INDEX "DocumentExtraction_organization_id_content_hash_idx" ON "DocumentExtraction"("organization_id", "content_hash");
