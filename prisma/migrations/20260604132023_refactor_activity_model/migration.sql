/*
  Warnings:

  - You are about to drop the column `contactId` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `dealId` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `taskId` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Activity` table. All the data in the column will be lost.
  - Added the required column `action` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityId` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entityType` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_contactId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_dealId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_userId_fkey";

-- DropIndex
DROP INDEX "Activity_contactId_idx";

-- DropIndex
DROP INDEX "Activity_dealId_idx";

-- DropIndex
DROP INDEX "Activity_taskId_idx";

-- DropIndex
DROP INDEX "Activity_userId_idx";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "contactId",
DROP COLUMN "dealId",
DROP COLUMN "taskId",
DROP COLUMN "type",
DROP COLUMN "userId",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "entityId" TEXT NOT NULL,
ADD COLUMN     "entityType" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "title" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Activity_entityType_entityId_idx" ON "Activity"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
