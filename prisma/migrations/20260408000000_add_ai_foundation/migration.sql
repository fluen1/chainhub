-- CreateEnum
CREATE TYPE "AIMode" AS ENUM ('OFF', 'SHADOW', 'BETA', 'LIVE');

-- AlterTable: Add ai_settings relation to Organization (no column needed, handled by OrganizationAISettings FK)
-- AlterTable: Add extraction relation to Document (no column needed, handled by DocumentExtraction FK)

-- CreateTable
CREATE TABLE "OrganizationAISettings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "ai_mode" "AIMode" NOT NULL DEFAULT 'OFF',
    "shadow_comparison_enabled" BOOLEAN NOT NULL DEFAULT false,
    "beta_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit_per_day" INTEGER NOT NULL DEFAULT 1000,
    "monthly_cost_cap_usd" DECIMAL(10,2),
    "kill_switch" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAISettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentExtraction" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "detected_type" TEXT,
    "type_confidence" DOUBLE PRECISION,
    "type_alternatives" JSONB,
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "model_name" TEXT NOT NULL,
    "model_temperature" DOUBLE PRECISION,
    "extracted_fields" JSONB NOT NULL,
    "extracted_fields_run2" JSONB,
    "agreement_score" DOUBLE PRECISION,
    "source_verification" JSONB,
    "sanity_check_results" JSONB,
    "discrepancies" JSONB,
    "raw_response" JSONB NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_cost_usd" DECIMAL(10,4) NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "field_decisions" JSONB,
    "extraction_status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentExtraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFieldCorrection" (
    "id" TEXT NOT NULL,
    "extraction_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "ai_value" JSONB NOT NULL,
    "user_value" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "schema_version" TEXT,
    "prompt_version" TEXT,
    "corrected_by" TEXT NOT NULL,
    "corrected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFieldCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationAISettings_organization_id_key" ON "OrganizationAISettings"("organization_id");

-- CreateIndex
CREATE INDEX "OrganizationAISettings_ai_mode_idx" ON "OrganizationAISettings"("ai_mode");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentExtraction_document_id_key" ON "DocumentExtraction"("document_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_document_id_idx" ON "DocumentExtraction"("document_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_organization_id_idx" ON "DocumentExtraction"("organization_id");

-- CreateIndex
CREATE INDEX "DocumentExtraction_detected_type_idx" ON "DocumentExtraction"("detected_type");

-- CreateIndex
CREATE INDEX "DocumentExtraction_reviewed_at_idx" ON "DocumentExtraction"("reviewed_at");

-- CreateIndex
CREATE INDEX "DocumentExtraction_extraction_status_idx" ON "DocumentExtraction"("extraction_status");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_field_name_idx" ON "AIFieldCorrection"("field_name");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_schema_version_idx" ON "AIFieldCorrection"("schema_version");

-- CreateIndex
CREATE INDEX "AIFieldCorrection_organization_id_idx" ON "AIFieldCorrection"("organization_id");

-- AddForeignKey
ALTER TABLE "OrganizationAISettings" ADD CONSTRAINT "OrganizationAISettings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentExtraction" ADD CONSTRAINT "DocumentExtraction_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFieldCorrection" ADD CONSTRAINT "AIFieldCorrection_extraction_id_fkey" FOREIGN KEY ("extraction_id") REFERENCES "DocumentExtraction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
