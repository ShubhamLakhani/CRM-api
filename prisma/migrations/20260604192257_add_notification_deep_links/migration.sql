-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "entityId" TEXT,
ADD COLUMN     "entityType" TEXT;

-- CreateIndex
CREATE INDEX "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
