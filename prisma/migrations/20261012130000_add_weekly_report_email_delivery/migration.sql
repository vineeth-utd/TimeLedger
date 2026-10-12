-- AlterTable
ALTER TABLE "weekly_reports"
ADD COLUMN "email_status" TEXT,
ADD COLUMN "email_sent_at" TIMESTAMPTZ,
ADD COLUMN "email_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "email_error_code" TEXT,
ADD COLUMN "email_recipient" TEXT;

-- CHECK constraint for email_status (keep in sync with src/lib/analytics/reportStatus.js)
ALTER TABLE "weekly_reports"
ADD CONSTRAINT "weekly_reports_email_status_check"
CHECK ("email_status" IS NULL OR "email_status" IN ('sending', 'sent', 'failed'));

