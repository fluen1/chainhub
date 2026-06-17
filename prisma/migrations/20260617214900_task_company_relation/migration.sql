-- CreateIndex
CREATE INDEX "FinancialMetric_organization_id_company_id_period_type_metr_idx" ON "FinancialMetric"("organization_id", "company_id", "period_type", "metric_type", "period_year");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
