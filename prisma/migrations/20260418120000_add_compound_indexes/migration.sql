-- Performance: compound indexes på ofte-brugte query-patterns
-- CONCURRENTLY undgår table-lock på produktion (sikkert at køre live).

-- CreateIndex (Task: list-queries der filtrerer på status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_organization_id_deleted_at_status_idx"
    ON "Task"("organization_id", "deleted_at", "status");

-- CreateIndex (Contract: company-detail aktive kontrakter — filtrerer på company + status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Contract_organization_id_company_id_deleted_at_status_idx"
    ON "Contract"("organization_id", "company_id", "deleted_at", "status");

-- CreateIndex (Case: list-queries der filtrerer på status)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Case_organization_id_deleted_at_status_idx"
    ON "Case"("organization_id", "deleted_at", "status");
