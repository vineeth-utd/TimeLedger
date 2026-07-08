-- Enable Row Level Security on user-owned tables.
ALTER TABLE "main_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sub_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "daily_sub_category_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "weekly_targets" ENABLE ROW LEVEL SECURITY;

-- main_categories
CREATE POLICY "main_categories_select_own"
ON "main_categories"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "main_categories_insert_own"
ON "main_categories"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "main_categories_update_own"
ON "main_categories"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "main_categories_delete_own"
ON "main_categories"
FOR DELETE
USING (auth.uid() = "user_id");

-- sub_categories
CREATE POLICY "sub_categories_select_own"
ON "sub_categories"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "sub_categories_insert_own"
ON "sub_categories"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "sub_categories_update_own"
ON "sub_categories"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "sub_categories_delete_own"
ON "sub_categories"
FOR DELETE
USING (auth.uid() = "user_id");

-- activities
CREATE POLICY "activities_select_own"
ON "activities"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "activities_insert_own"
ON "activities"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "activities_update_own"
ON "activities"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "activities_delete_own"
ON "activities"
FOR DELETE
USING (auth.uid() = "user_id");

-- daily_sub_category_summaries
CREATE POLICY "daily_sub_category_summaries_select_own"
ON "daily_sub_category_summaries"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "daily_sub_category_summaries_insert_own"
ON "daily_sub_category_summaries"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "daily_sub_category_summaries_update_own"
ON "daily_sub_category_summaries"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "daily_sub_category_summaries_delete_own"
ON "daily_sub_category_summaries"
FOR DELETE
USING (auth.uid() = "user_id");

-- weekly_targets
CREATE POLICY "weekly_targets_select_own"
ON "weekly_targets"
FOR SELECT
USING (auth.uid() = "user_id");

CREATE POLICY "weekly_targets_insert_own"
ON "weekly_targets"
FOR INSERT
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "weekly_targets_update_own"
ON "weekly_targets"
FOR UPDATE
USING (auth.uid() = "user_id")
WITH CHECK (auth.uid() = "user_id");

CREATE POLICY "weekly_targets_delete_own"
ON "weekly_targets"
FOR DELETE
USING (auth.uid() = "user_id");
