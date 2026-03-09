-- Tilføj priority kolonne til tasks tabel
-- Prioritet enum er allerede defineret via Deadline-modellen

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "priority" "Prioritet" NOT NULL DEFAULT 'MELLEM';

-- Index for priority + organization_id queries
CREATE INDEX IF NOT EXISTS "tasks_organization_id_priority_deleted_at_idx" 
ON "tasks"("organization_id", "priority", "deleted_at");