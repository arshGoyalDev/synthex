-- AlterTable
ALTER TABLE "oauth_accounts"
ADD COLUMN "access_token" TEXT,
ADD COLUMN "token_scope" TEXT;
