/*
  Warnings:

  - A unique constraint covering the columns `[user_id,summary_date,sub_category_id]` on the table `daily_sub_category_summaries` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,name]` on the table `main_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,week_start_date,main_category_id]` on the table `weekly_targets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_id` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `daily_sub_category_summaries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `main_categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `sub_categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `weekly_targets` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "daily_sub_category_summaries_summary_date_sub_category_id_key";

-- DropIndex
DROP INDEX "main_categories_name_key";

-- DropIndex
DROP INDEX "weekly_targets_week_start_date_main_category_id_key";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "daily_sub_category_summaries" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "main_categories" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "sub_categories" ADD COLUMN     "user_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "weekly_targets" ADD COLUMN     "user_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "activities_user_id_idx" ON "activities"("user_id");

-- CreateIndex
CREATE INDEX "daily_sub_category_summaries_user_id_idx" ON "daily_sub_category_summaries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sub_category_summaries_user_id_summary_date_sub_categ_key" ON "daily_sub_category_summaries"("user_id", "summary_date", "sub_category_id");

-- CreateIndex
CREATE INDEX "main_categories_user_id_idx" ON "main_categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "main_categories_user_id_name_key" ON "main_categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "sub_categories_user_id_idx" ON "sub_categories"("user_id");

-- CreateIndex
CREATE INDEX "weekly_targets_user_id_idx" ON "weekly_targets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_targets_user_id_week_start_date_main_category_id_key" ON "weekly_targets"("user_id", "week_start_date", "main_category_id");
