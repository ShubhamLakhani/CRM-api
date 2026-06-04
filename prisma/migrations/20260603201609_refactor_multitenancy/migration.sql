-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedBy" TEXT,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- AlterTable (Add columns as nullable first to allow migration)
ALTER TABLE "Organization" ADD COLUMN "logo" TEXT;
ALTER TABLE "Organization" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "slug" TEXT;

-- Data Migration Phase
-- 1. Generate slugs for existing organizations
UPDATE "Organization"
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- Fallback for empty slugs
UPDATE "Organization"
SET "slug" = 'org-' || substring("id"::text from 1 for 8)
WHERE "slug" IS NULL OR "slug" = '';

-- Ensure unique slug if there are duplicate slugs by appending parts of id
UPDATE "Organization" o
SET "slug" = "slug" || '-' || substring("id"::text from 1 for 4)
WHERE (SELECT COUNT(*) FROM "Organization" o2 WHERE o2."slug" = o."slug") > 1;

-- 2. Set ownerId to the first user of the organization
UPDATE "Organization" o
SET "ownerId" = (
  SELECT u.id
  FROM "User" u
  WHERE u."organizationId" = o.id
  ORDER BY u."createdAt" ASC
  LIMIT 1
)
WHERE o."ownerId" IS NULL;

-- Fallback for ownerId if organization has no users
UPDATE "Organization" o
SET "ownerId" = (
  SELECT id FROM "User" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE o."ownerId" IS NULL;

-- 3. Create OrganizationMember entries for all existing users
INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "roleId", "joinedAt", "invitedBy")
SELECT 
  gen_random_uuid()::text,
  "organizationId", 
  "id", 
  "role",
  "createdAt", 
  NULL
FROM "User"
WHERE "organizationId" IS NOT NULL
ON CONFLICT ("organizationId", "userId") DO NOTHING;

-- Post-Data Migration Constraint Enforcements
-- Make slug NOT NULL and UNIQUE
ALTER TABLE "Organization" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- Drop domain column from Organization
ALTER TABLE "Organization" DROP COLUMN "domain";

-- Drop foreign key and column organizationId from User
ALTER TABLE "User" DROP CONSTRAINT "User_organizationId_fkey";
ALTER TABLE "User" DROP COLUMN "organizationId";

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
