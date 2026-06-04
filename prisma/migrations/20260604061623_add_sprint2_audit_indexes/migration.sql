-- CreateIndex
CREATE INDEX "OrganizationInvite_roleId_idx" ON "OrganizationInvite"("roleId");

-- CreateIndex
CREATE INDEX "OrganizationInvite_email_idx" ON "OrganizationInvite"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_roleId_idx" ON "OrganizationMember"("roleId");

-- Insert default permissions for companies and tasks
INSERT INTO "Permission" ("id", "action") VALUES
('companies.create', 'companies.create'),
('companies.update', 'companies.update'),
('companies.delete', 'companies.delete'),
('tasks.create', 'tasks.create'),
('tasks.update', 'tasks.update'),
('tasks.delete', 'tasks.delete')
ON CONFLICT ("id") DO NOTHING;

-- Map permissions to OWNER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('OWNER', 'companies.create'),
('OWNER', 'companies.update'),
('OWNER', 'companies.delete'),
('OWNER', 'tasks.create'),
('OWNER', 'tasks.update'),
('OWNER', 'tasks.delete')
ON CONFLICT DO NOTHING;

-- Map permissions to ADMIN
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('ADMIN', 'companies.create'),
('ADMIN', 'companies.update'),
('ADMIN', 'companies.delete'),
('ADMIN', 'tasks.create'),
('ADMIN', 'tasks.update'),
('ADMIN', 'tasks.delete')
ON CONFLICT DO NOTHING;

-- Map permissions to MANAGER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('MANAGER', 'companies.create'),
('MANAGER', 'companies.update'),
('MANAGER', 'tasks.create'),
('MANAGER', 'tasks.update')
ON CONFLICT DO NOTHING;

-- Map permissions to SALES
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('SALES', 'companies.create'),
('SALES', 'companies.update'),
('SALES', 'tasks.create'),
('SALES', 'tasks.update')
ON CONFLICT DO NOTHING;

-- Map permissions to SUPPORT
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('SUPPORT', 'companies.update'),
('SUPPORT', 'tasks.update')
ON CONFLICT DO NOTHING;

-- Map permissions to USER (for backward compatibility)
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('USER', 'companies.create'),
('USER', 'companies.update'),
('USER', 'tasks.create'),
('USER', 'tasks.update')
ON CONFLICT DO NOTHING;
