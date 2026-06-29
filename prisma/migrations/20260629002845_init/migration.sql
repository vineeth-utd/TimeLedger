-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "activity_date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ NOT NULL,
    "end_time" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_category_summaries" (
    "id" SERIAL NOT NULL,
    "summary_date" DATE NOT NULL,
    "category_id" INTEGER NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "total_activities" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_category_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_targets" (
    "id" SERIAL NOT NULL,
    "week_start_date" DATE NOT NULL,
    "category_id" INTEGER NOT NULL,
    "target_minutes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "weekly_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "activities_activity_date_idx" ON "activities"("activity_date");

-- CreateIndex
CREATE INDEX "activities_category_id_idx" ON "activities"("category_id");

-- CreateIndex
CREATE INDEX "activities_start_time_idx" ON "activities"("start_time");

-- CreateIndex
CREATE INDEX "activities_end_time_idx" ON "activities"("end_time");

-- CreateIndex
CREATE INDEX "daily_category_summaries_summary_date_idx" ON "daily_category_summaries"("summary_date");

-- CreateIndex
CREATE INDEX "daily_category_summaries_category_id_idx" ON "daily_category_summaries"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_category_summaries_summary_date_category_id_key" ON "daily_category_summaries"("summary_date", "category_id");

-- CreateIndex
CREATE INDEX "weekly_targets_week_start_date_idx" ON "weekly_targets"("week_start_date");

-- CreateIndex
CREATE INDEX "weekly_targets_category_id_idx" ON "weekly_targets"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_targets_week_start_date_category_id_key" ON "weekly_targets"("week_start_date", "category_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_category_summaries" ADD CONSTRAINT "daily_category_summaries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
