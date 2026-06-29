-- CreateTable
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "connected_id" TEXT NOT NULL,
    "ig_user_id" TEXT NOT NULL,
    "ig_username" TEXT NOT NULL,
    "alias" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_user_id_connected_id_key"
ON "social_accounts"("user_id", "connected_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_accounts_user_id_idx"
ON "social_accounts"("user_id");

-- AddForeignKey
ALTER TABLE "social_accounts"
ADD CONSTRAINT "social_accounts_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
