-- AlterTable

-- AlterTable
ALTER TABLE "TaskTemplate" ADD COLUMN     "defaultAssigneeId" TEXT;

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
