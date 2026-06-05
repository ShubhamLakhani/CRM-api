-- Insert audit.view permission
INSERT INTO "Permission" ("id", "action") VALUES
('audit.view', 'audit.view')
ON CONFLICT ("id") DO NOTHING;

-- Map audit.view permission to OWNER
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('OWNER', 'audit.view')
ON CONFLICT DO NOTHING;

-- Map audit.view permission to ADMIN
INSERT INTO "RolePermission" ("roleId", "permissionId") VALUES
('ADMIN', 'audit.view')
ON CONFLICT DO NOTHING;