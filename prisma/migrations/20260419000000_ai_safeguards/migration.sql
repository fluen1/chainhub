-- AlterTable: tilføj cache-token-kolonner til AIUsageLog
ALTER TABLE "AIUsageLog" ADD COLUMN "cache_read_tokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AIUsageLog" ADD COLUMN "cache_write_tokens" INTEGER NOT NULL DEFAULT 0;

-- Data-migration: sæt default på eksisterende NULL-værdier FØR vi sætter NOT NULL
UPDATE "OrganizationAISettings" SET "monthly_cost_cap_usd" = 50.00 WHERE "monthly_cost_cap_usd" IS NULL;

-- AlterTable: gør monthly_cost_cap_usd NOT NULL med default 50.00
ALTER TABLE "OrganizationAISettings" ALTER COLUMN "monthly_cost_cap_usd" SET NOT NULL,
                                    ALTER COLUMN "monthly_cost_cap_usd" SET DEFAULT 50.00;
