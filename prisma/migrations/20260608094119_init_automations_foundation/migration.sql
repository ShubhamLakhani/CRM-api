-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('CONTACT_CREATED', 'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'DEAL_WON', 'TASK_COMPLETED', 'USER_INVITED');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('CREATE_TASK', 'SEND_NOTIFICATION', 'SEND_EMAIL');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "triggerEvent" "AutomationTrigger" NOT NULL,
    "conditionsJson" JSONB,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "actionType" "AutomationActionType" NOT NULL,
    "configurationJson" JSONB NOT NULL,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecution" (
    "id" TEXT NOT NULL,
    "automationExecutionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "status" "AutomationExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_organizationId_idx" ON "AutomationRule"("organizationId");

-- CreateIndex
CREATE INDEX "AutomationRule_triggerEvent_idx" ON "AutomationRule"("triggerEvent");

-- CreateIndex
CREATE INDEX "AutomationRule_isEnabled_idx" ON "AutomationRule"("isEnabled");

-- CreateIndex
CREATE INDEX "AutomationAction_ruleId_idx" ON "AutomationAction"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecution_automationExecutionId_key" ON "AutomationExecution"("automationExecutionId");

-- CreateIndex
CREATE INDEX "AutomationExecution_organizationId_idx" ON "AutomationExecution"("organizationId");

-- CreateIndex
CREATE INDEX "AutomationExecution_ruleId_idx" ON "AutomationExecution"("ruleId");

-- CreateIndex
CREATE INDEX "AutomationExecution_status_idx" ON "AutomationExecution"("status");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert permissions for automations
INSERT INTO "Permission" ("id", "action") VALUES
('automations.view', 'automations.view'),
('automations.create', 'automations.create'),
('automations.update', 'automations.update'),
('automations.delete', 'automations.delete')
ON CONFLICT ("id") DO NOTHING;

-- Map permissions to OWNER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('OWNER', 'automations.view'),
('OWNER', 'automations.create'),
('OWNER', 'automations.update'),
('OWNER', 'automations.delete')
ON CONFLICT DO NOTHING;

-- Map permissions to ADMIN
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('ADMIN', 'automations.view'),
('ADMIN', 'automations.create'),
('ADMIN', 'automations.update'),
('ADMIN', 'automations.delete')
ON CONFLICT DO NOTHING;

-- Map permissions to MANAGER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('MANAGER', 'automations.view')
ON CONFLICT DO NOTHING;
