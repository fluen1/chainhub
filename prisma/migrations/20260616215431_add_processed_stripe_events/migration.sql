-- CreateTable
CREATE TABLE "ProcessedStripeEvent" (
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedStripeEvent_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "ProcessedStripeEvent_processed_at_idx" ON "ProcessedStripeEvent"("processed_at");
