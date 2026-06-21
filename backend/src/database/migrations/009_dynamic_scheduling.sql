ALTER TABLE clients
  ADD COLUMN timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Colombo' AFTER member_group_plural;

INSERT INTO systems (code, name, description)
VALUES ('scheduling', 'Scheduling', 'Build reusable schedule structures, templates, and published member calendars.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  status = 'active';

INSERT IGNORE INTO tenant_systems (client_id, system_code, enabled)
SELECT id, 'scheduling', FALSE FROM clients;

CREATE TABLE schedule_taxonomy_nodes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_taxonomy_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_taxonomy_parent FOREIGN KEY (parent_id) REFERENCES schedule_taxonomy_nodes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_taxonomy_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_taxonomy_sibling (client_id, parent_id, name),
  INDEX idx_schedule_taxonomy_parent (client_id, parent_id, sort_order)
);

CREATE TABLE schedule_day_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_slots_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_slots_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_slots_name (client_id, name),
  INDEX idx_schedule_slots_order (client_id, status, sort_order)
);

CREATE TABLE schedule_session_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  taxonomy_node_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  duration_minutes SMALLINT UNSIGNED NULL,
  objective TEXT NULL,
  instructions TEXT NULL,
  intensity VARCHAR(80) NULL,
  location VARCHAR(190) NULL,
  equipment TEXT NULL,
  staff_notes TEXT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_sessions_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_sessions_taxonomy FOREIGN KEY (taxonomy_node_id) REFERENCES schedule_taxonomy_nodes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_sessions_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_sessions_name (client_id, name),
  INDEX idx_schedule_sessions_status (client_id, status)
);

CREATE TABLE schedule_week_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NULL,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_weeks_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_weeks_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_weeks_name (client_id, name)
);

CREATE TABLE schedule_week_template_entries (
  week_template_id BIGINT UNSIGNED NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  slot_id BIGINT UNSIGNED NOT NULL,
  session_template_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (week_template_id, weekday, slot_id),
  CONSTRAINT fk_schedule_week_entries_week FOREIGN KEY (week_template_id) REFERENCES schedule_week_templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_week_entries_slot FOREIGN KEY (slot_id) REFERENCES schedule_day_slots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_week_entries_session FOREIGN KEY (session_template_id) REFERENCES schedule_session_templates(id) ON DELETE RESTRICT,
  CONSTRAINT chk_schedule_weekday CHECK (weekday BETWEEN 1 AND 7)
);

CREATE TABLE schedule_plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  generation_mode ENUM('day', 'week', 'range') NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  source_week_template_id BIGINT UNSIGNED NULL,
  status ENUM('draft', 'published', 'cancelled') NOT NULL DEFAULT 'draft',
  owner_user_id BIGINT UNSIGNED NOT NULL,
  published_by_user_id BIGINT UNSIGNED NULL,
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_plans_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_plans_week FOREIGN KEY (source_week_template_id) REFERENCES schedule_week_templates(id) ON DELETE SET NULL,
  CONSTRAINT fk_schedule_plans_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_plans_publisher FOREIGN KEY (published_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_schedule_plans_calendar (client_id, start_date, end_date, status)
);

CREATE TABLE schedule_plan_target_groups (
  plan_id BIGINT UNSIGNED NOT NULL,
  member_group_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (plan_id, member_group_id),
  CONSTRAINT fk_schedule_targets_plan FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_targets_group FOREIGN KEY (member_group_id) REFERENCES member_groups(id) ON DELETE RESTRICT
);

CREATE TABLE schedule_plan_target_users (
  plan_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (plan_id, user_id),
  CONSTRAINT fk_schedule_user_targets_plan FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_user_targets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE schedule_occurrences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  schedule_date DATE NOT NULL,
  slot_id BIGINT UNSIGNED NOT NULL,
  session_template_id BIGINT UNSIGNED NOT NULL,
  session_snapshot JSON NOT NULL,
  taxonomy_path_snapshot JSON NOT NULL,
  status ENUM('draft', 'published', 'cancelled') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_schedule_occurrences_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_occurrences_plan FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_occurrences_slot FOREIGN KEY (slot_id) REFERENCES schedule_day_slots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_occurrences_session FOREIGN KEY (session_template_id) REFERENCES schedule_session_templates(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_plan_cell (plan_id, schedule_date, slot_id),
  INDEX idx_schedule_occurrences_calendar (client_id, schedule_date, status)
);

CREATE TABLE schedule_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  occurrence_id BIGINT UNSIGNED NOT NULL,
  member_user_id BIGINT UNSIGNED NOT NULL,
  schedule_date DATE NOT NULL,
  slot_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active', 'replaced', 'cancelled') NOT NULL DEFAULT 'active',
  replaced_by_assignment_id BIGINT UNSIGNED NULL,
  published_by_user_id BIGINT UNSIGNED NOT NULL,
  published_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_by_user_id BIGINT UNSIGNED NULL,
  cancelled_at TIMESTAMP NULL,
  active_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status = 'active' THEN 1 ELSE NULL END) STORED,
  CONSTRAINT fk_schedule_assignments_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_assignments_occurrence FOREIGN KEY (occurrence_id) REFERENCES schedule_occurrences(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_member FOREIGN KEY (member_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_slot FOREIGN KEY (slot_id) REFERENCES schedule_day_slots(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_replacement FOREIGN KEY (replaced_by_assignment_id) REFERENCES schedule_assignments(id) ON DELETE SET NULL,
  CONSTRAINT fk_schedule_assignments_publisher FOREIGN KEY (published_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_schedule_assignments_canceller FOREIGN KEY (cancelled_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_schedule_active_assignment (client_id, member_user_id, schedule_date, slot_id, active_guard),
  INDEX idx_schedule_member_calendar (client_id, member_user_id, schedule_date, status)
);
