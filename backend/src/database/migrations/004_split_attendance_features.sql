INSERT IGNORE INTO features (code, name, description)
VALUES
  ('attendance_staff', 'Staff Attendance', 'Track attendance for tenant staff.'),
  ('attendance_member', 'Member Attendance', 'Track attendance for tenant members.');

INSERT IGNORE INTO client_features (client_id, feature_id, enabled)
SELECT c.id, f.id, COALESCE(existing.enabled, TRUE)
FROM clients c
CROSS JOIN features f
LEFT JOIN features legacy_feature ON legacy_feature.code = 'attendance'
LEFT JOIN client_features existing ON existing.client_id = c.id AND existing.feature_id = legacy_feature.id
WHERE f.code IN ('attendance_staff', 'attendance_member');
