-- CreateTable
CREATE TABLE "assistant_action_claims" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" TEXT NOT NULL,
    "action_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "claimed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_action_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assistant_action_claims_user_id_thread_id_action_id_key"
ON "assistant_action_claims"("user_id", "thread_id", "action_id");

-- Server-side only: RLS on with no policies denies the Supabase client roles; the
-- application's own database connection is unaffected.
ALTER TABLE "assistant_action_claims" ENABLE ROW LEVEL SECURITY;
