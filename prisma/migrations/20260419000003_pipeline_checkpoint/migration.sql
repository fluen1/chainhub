-- Task 13: Checkpoint pipeline-state så retries ikke starter fra Pass 1.
-- Persister typeResult + run1 så retry efter Pass 2-fejl kan resume.
ALTER TABLE "DocumentExtraction" ADD COLUMN "pipeline_checkpoint" JSONB;
