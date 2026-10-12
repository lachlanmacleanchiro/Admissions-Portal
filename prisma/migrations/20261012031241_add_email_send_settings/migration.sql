-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "emailFromAddress" TEXT,
ADD COLUMN     "emailFromName" TEXT,
ADD COLUMN     "resendApiKeyEncrypted" TEXT,
ADD COLUMN     "resendApiKeyLast4" TEXT;

