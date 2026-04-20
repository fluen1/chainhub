-- Pre-debet cost-cap: reservationskolonner for atomisk budgetreservation
-- Task 10 af AI Cost Safeguards — fikser race condition hvor parallelle jobs
-- alle passerer checkCostCap samtidigt før usage logges.
ALTER TABLE "OrganizationAISettings" ADD COLUMN "reserved_cost_usd" DECIMAL(10, 4) NOT NULL DEFAULT 0;
ALTER TABLE "OrganizationAISettings" ADD COLUMN "reservation_period" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
