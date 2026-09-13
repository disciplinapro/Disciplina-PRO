ALTER TABLE "users"
  ADD COLUMN "password_reset_hash" CHAR(64),
  ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "password_reset_requested_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "users_password_reset_hash_key" ON "users"("password_reset_hash");
