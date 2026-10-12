-- CreateTable
CREATE TABLE "user_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "productivity_agent_enabled" BOOLEAN NOT NULL DEFAULT false,
    "weekly_email_reports_enabled" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "week_start_date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "generation_started_at" TIMESTAMPTZ,
    "generated_at" TIMESTAMPTZ,
    "error_code" TEXT,
    "facts" JSONB,
    "content" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_user_id_week_start_date_key" ON "weekly_reports"("user_id", "week_start_date");

-- Not expressible in schema.prisma: keep in sync with src/lib/analytics/reportStatus.js.
ALTER TABLE "weekly_reports"
ADD CONSTRAINT "weekly_reports_status_check"
CHECK ("status" IN ('generating', 'completed', 'failed'));

-- A report week is always a Monday (Monday-Sunday weeks).
ALTER TABLE "weekly_reports"
ADD CONSTRAINT "weekly_reports_week_start_monday_check"
CHECK (EXTRACT(ISODOW FROM "week_start_date") = 1);

-- A completed report always carries its facts snapshot, generated content and completion time.
ALTER TABLE "weekly_reports"
ADD CONSTRAINT "weekly_reports_completed_check"
CHECK ("status" <> 'completed' OR ("facts" IS NOT NULL AND "content" IS NOT NULL AND "generated_at" IS NOT NULL));

-- Row Level Security: own-row policies, same model as the other user-owned tables.
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_reports" ENABLE ROW LEVEL SECURITY;

-- user_preferences
CREATE POLICY "user_preferences_select_own"
ON "user_preferences"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "user_preferences_insert_own"
ON "user_preferences"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "user_preferences_update_own"
ON "user_preferences"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "user_preferences_delete_own"
ON "user_preferences"
FOR DELETE
USING (auth.uid() = "user_id");

-- weekly_reports
CREATE POLICY "weekly_reports_select_own"
ON "weekly_reports"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "weekly_reports_insert_own"
ON "weekly_reports"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "weekly_reports_update_own"
ON "weekly_reports"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "weekly_reports_delete_own"
ON "weekly_reports"
FOR DELETE
USING (auth.uid() = "user_id");
