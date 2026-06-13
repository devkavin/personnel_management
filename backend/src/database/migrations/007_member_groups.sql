ALTER TABLE clients
  ADD COLUMN member_group_singular VARCHAR(80) NOT NULL DEFAULT 'Class' AFTER new_user_identifier_label,
  ADD COLUMN member_group_plural VARCHAR(80) NOT NULL DEFAULT 'Classes' AFTER member_group_singular;

CREATE TABLE IF NOT EXISTS member_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_member_groups_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_groups_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_member_groups_client_name (client_id, name),
  INDEX idx_member_groups_client_status (client_id, status)
);

CREATE TABLE IF NOT EXISTS member_group_members (
  member_group_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_group_id, user_id),
  CONSTRAINT fk_member_group_members_group FOREIGN KEY (member_group_id) REFERENCES member_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_member_group_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
