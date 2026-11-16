-- AlterEnum
ALTER TYPE "PermissionKey" ADD VALUE 'UPLOAD_DOCUMENTS';
ALTER TYPE "PermissionKey" ADD VALUE 'PUBLISH_DOCUMENTS';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "uploadedByStaffId" TEXT,
ADD COLUMN     "publishedToStudent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByStaffId_fkey" FOREIGN KEY ("uploadedByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
