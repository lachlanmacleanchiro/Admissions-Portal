-- CreateEnum
CREATE TYPE "MessagingMode" AS ENUM ('CHAT', 'THREADS');

-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN     "messagingMode" "MessagingMode" NOT NULL DEFAULT 'CHAT';
