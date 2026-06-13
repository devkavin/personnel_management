ALTER TABLE users
  MODIFY role ENUM('super_admin', 'client_admin', 'user', 'tenant_admin', 'tenant_staff', 'tenant_member') NOT NULL;

UPDATE users SET role = 'tenant_admin' WHERE role = 'client_admin';
UPDATE users SET role = 'tenant_member' WHERE role = 'user';

ALTER TABLE users
  MODIFY role ENUM('super_admin', 'tenant_admin', 'tenant_staff', 'tenant_member') NOT NULL;

ALTER TABLE clients
  ADD COLUMN staff_singular VARCHAR(80) NOT NULL DEFAULT 'staff',
  ADD COLUMN staff_plural VARCHAR(80) NOT NULL DEFAULT 'staff',
  ADD COLUMN member_singular VARCHAR(80) NOT NULL DEFAULT 'member',
  ADD COLUMN member_plural VARCHAR(80) NOT NULL DEFAULT 'members';

UPDATE clients
SET member_singular = person_singular,
    member_plural = person_plural;
