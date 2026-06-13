CREATE TABLE IF NOT EXISTS systems (
  code VARCHAR(120) PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_systems (
  client_id BIGINT UNSIGNED NOT NULL,
  system_code VARCHAR(120) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, system_code),
  CONSTRAINT fk_tenant_systems_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_systems_system FOREIGN KEY (system_code) REFERENCES systems(code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_system_settings (
  client_id BIGINT UNSIGNED NOT NULL,
  system_code VARCHAR(120) NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, system_code, setting_key),
  CONSTRAINT fk_tenant_system_settings_tenant_system
    FOREIGN KEY (client_id, system_code) REFERENCES tenant_systems(client_id, system_code) ON DELETE CASCADE
);

INSERT INTO systems (code, name, description)
VALUES ('attendance', 'Attendance', 'Record and report staff and member attendance.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = 'active';

INSERT IGNORE INTO tenant_systems (client_id, system_code, enabled)
SELECT
  c.id,
  'attendance',
  COALESCE(legacy.enabled, TRUE)
FROM clients c
LEFT JOIN features legacy_feature ON legacy_feature.code = 'attendance'
LEFT JOIN client_features legacy ON legacy.client_id = c.id AND legacy.feature_id = legacy_feature.id;

INSERT IGNORE INTO tenant_system_settings (client_id, system_code, setting_key, setting_value)
SELECT
  c.id,
  'attendance',
  'staff_attendance_enabled',
  IF(COALESCE(staff_feature.enabled, TRUE), 'true', 'false')
FROM clients c
LEFT JOIN features staff ON staff.code = 'attendance_staff'
LEFT JOIN client_features staff_feature ON staff_feature.client_id = c.id AND staff_feature.feature_id = staff.id;

INSERT IGNORE INTO tenant_system_settings (client_id, system_code, setting_key, setting_value)
SELECT
  c.id,
  'attendance',
  'member_attendance_enabled',
  IF(COALESCE(member_feature.enabled, TRUE), 'true', 'false')
FROM clients c
LEFT JOIN features member ON member.code = 'attendance_member'
LEFT JOIN client_features member_feature ON member_feature.client_id = c.id AND member_feature.feature_id = member.id;
