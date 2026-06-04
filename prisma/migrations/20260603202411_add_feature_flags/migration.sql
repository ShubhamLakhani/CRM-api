-- CreateTable
CREATE TABLE "Feature" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Feature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationFeature" (
    "organizationId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationFeature_pkey" PRIMARY KEY ("organizationId","featureId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Feature_name_key" ON "Feature"("name");

-- CreateIndex
CREATE INDEX "OrganizationFeature_organizationId_idx" ON "OrganizationFeature"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationFeature_featureId_idx" ON "OrganizationFeature"("featureId");

-- Insert Default Features
INSERT INTO "Feature" ("id", "name", "description") VALUES
('AI_ASSISTANT', 'AI_ASSISTANT', 'Enables AI-powered relationship intelligence and assistance'),
('EMAIL_SYNC', 'EMAIL_SYNC', 'Allows synchronizing emails with workspace contacts'),
('AUTOMATION', 'AUTOMATION', 'Enables triggering automated pipelines and alerts'),
('CUSTOM_FIELDS', 'CUSTOM_FIELDS', 'Allows adding custom attributes on contacts and companies'),
('CLIENT_PORTAL', 'CLIENT_PORTAL', 'Enables secure client portal access for external collaborators')
ON CONFLICT ("id") DO NOTHING;

-- Link existing organizations to all features
INSERT INTO "OrganizationFeature" ("organizationId", "featureId", "isEnabled")
SELECT o.id, f.id, true
FROM "Organization" o, "Feature" f
ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "OrganizationFeature" ADD CONSTRAINT "OrganizationFeature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationFeature" ADD CONSTRAINT "OrganizationFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
