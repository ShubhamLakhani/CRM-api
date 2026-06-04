-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_action_key" ON "Permission"("action");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- Insert Default Roles
INSERT INTO "Role" ("id", "name") VALUES
('OWNER', 'Owner'),
('ADMIN', 'Admin'),
('MANAGER', 'Manager'),
('SALES', 'Sales'),
('SUPPORT', 'Support'),
('VIEWER', 'Viewer'),
('USER', 'User')
ON CONFLICT ("id") DO NOTHING;

-- Insert Default Permissions
INSERT INTO "Permission" ("id", "action") VALUES
('contacts.create', 'contacts.create'),
('contacts.update', 'contacts.update'),
('contacts.delete', 'contacts.delete'),
('deals.create', 'deals.create'),
('deals.update', 'deals.update'),
('deals.delete', 'deals.delete'),
('users.invite', 'users.invite'),
('users.manage', 'users.manage'),
('billing.manage', 'billing.manage')
ON CONFLICT ("id") DO NOTHING;

-- Map Permissions to OWNER
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'OWNER', id FROM "Permission"
ON CONFLICT DO NOTHING;

-- Map Permissions to ADMIN
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT 'ADMIN', id FROM "Permission"
ON CONFLICT DO NOTHING;

-- Map Permissions to MANAGER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('MANAGER', 'contacts.create'),
('MANAGER', 'contacts.update'),
('MANAGER', 'deals.create'),
('MANAGER', 'deals.update'),
('MANAGER', 'users.invite')
ON CONFLICT DO NOTHING;

-- Map Permissions to SALES
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('SALES', 'contacts.create'),
('SALES', 'contacts.update'),
('SALES', 'deals.create'),
('SALES', 'deals.update')
ON CONFLICT DO NOTHING;

-- Map Permissions to SUPPORT
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('SUPPORT', 'contacts.update'),
('SUPPORT', 'deals.update')
ON CONFLICT DO NOTHING;

-- Map Permissions to USER (backward compatibility mapping)
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('USER', 'contacts.create'),
('USER', 'contacts.update'),
('USER', 'deals.create'),
('USER', 'deals.update')
ON CONFLICT DO NOTHING;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
