/*
  Warnings:

  - You are about to drop the column `category_id` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `category_id` on the `weekly_targets` table. All the data in the column will be lost.
  - You are about to drop the `categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `daily_category_summaries` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[week_start_date,main_category_id]` on the table `weekly_targets` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sub_category_id` to the `activities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `main_category_id` to the `weekly_targets` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_category_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_category_summaries" DROP CONSTRAINT "daily_category_summaries_category_id_fkey";

-- DropForeignKey
ALTER TABLE "weekly_targets" DROP CONSTRAINT "weekly_targets_category_id_fkey";

-- DropIndex
DROP INDEX "activities_category_id_idx";

-- DropIndex
DROP INDEX "weekly_targets_category_id_idx";

-- DropIndex
DROP INDEX "weekly_targets_week_start_date_category_id_key";

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "category_id",
ADD COLUMN     "sub_category_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "weekly_targets" DROP COLUMN "category_id",
ADD COLUMN     "main_category_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "categories";

-- DropTable
DROP TABLE "daily_category_summaries";

-- CreateTable
CREATE TABLE "main_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "main_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" SERIAL NOT NULL,
    "main_category_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_sub_category_summaries" (
    "id" SERIAL NOT NULL,
    "summary_date" DATE NOT NULL,
    "sub_category_id" INTEGER NOT NULL,
    "total_minutes" INTEGER NOT NULL,
    "total_activities" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "daily_sub_category_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "main_categories_name_key" ON "main_categories"("name");

-- CreateIndex
CREATE INDEX "sub_categories_main_category_id_idx" ON "sub_categories"("main_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "sub_categories_main_category_id_name_key" ON "sub_categories"("main_category_id", "name");

-- CreateIndex
CREATE INDEX "daily_sub_category_summaries_summary_date_idx" ON "daily_sub_category_summaries"("summary_date");

-- CreateIndex
CREATE INDEX "daily_sub_category_summaries_sub_category_id_idx" ON "daily_sub_category_summaries"("sub_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_sub_category_summaries_summary_date_sub_category_id_key" ON "daily_sub_category_summaries"("summary_date", "sub_category_id");

-- CreateIndex
CREATE INDEX "activities_sub_category_id_idx" ON "activities"("sub_category_id");

-- CreateIndex
CREATE INDEX "weekly_targets_main_category_id_idx" ON "weekly_targets"("main_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_targets_week_start_date_main_category_id_key" ON "weekly_targets"("week_start_date", "main_category_id");

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_sub_category_summaries" ADD CONSTRAINT "daily_sub_category_summaries_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_targets" ADD CONSTRAINT "weekly_targets_main_category_id_fkey" FOREIGN KEY ("main_category_id") REFERENCES "main_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
