-- CreateEnum
CREATE TYPE "ResidencyStatus" AS ENUM ('PERMANENT_RESIDENT', 'RESIDENT_VISA', 'AUSTRALIAN_CITIZEN_OR_RESIDENT', 'REFUGEE_OR_PROTECTED_PERSON', 'OTHER');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "isNzCitizen" BOOLEAN,
ADD COLUMN     "residencyStatus" "ResidencyStatus",
ADD COLUMN     "residencyStatusDetails" TEXT;
