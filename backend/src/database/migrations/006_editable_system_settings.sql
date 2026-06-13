CREATE TABLE IF NOT EXISTS system_settings (
  system_code VARCHAR(120) NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (system_code, setting_key),
  CONSTRAINT fk_system_settings_system FOREIGN KEY (system_code) REFERENCES systems(code) ON DELETE CASCADE
);

INSERT IGNORE INTO system_settings (system_code, setting_key, setting_value)
VALUES
  ('attendance', 'default_attendance_status', 'present'),
  ('attendance', 'notes_enabled', 'true');
