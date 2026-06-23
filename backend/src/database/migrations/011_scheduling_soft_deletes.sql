ALTER TABLE schedule_taxonomy_nodes
  MODIFY status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMP NULL,
  ADD COLUMN deleted_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN uniqueness_parent_id BIGINT UNSIGNED GENERATED ALWAYS AS (COALESCE(parent_id, 0)) STORED,
  ADD COLUMN operational_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status <> 'deleted' THEN 1 ELSE NULL END) STORED,
  DROP INDEX uq_schedule_taxonomy_sibling,
  ADD UNIQUE KEY uq_schedule_taxonomy_operational (client_id, uniqueness_parent_id, name, operational_guard),
  ADD CONSTRAINT fk_schedule_taxonomy_deleter FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE schedule_day_slots
  MODIFY status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMP NULL,
  ADD COLUMN deleted_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN operational_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status <> 'deleted' THEN 1 ELSE NULL END) STORED,
  DROP INDEX uq_schedule_slots_name,
  ADD UNIQUE KEY uq_schedule_slots_operational (client_id, name, operational_guard),
  ADD CONSTRAINT fk_schedule_slots_deleter FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE schedule_session_templates
  MODIFY status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMP NULL,
  ADD COLUMN deleted_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN operational_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status <> 'deleted' THEN 1 ELSE NULL END) STORED,
  DROP INDEX uq_schedule_sessions_name,
  ADD UNIQUE KEY uq_schedule_sessions_operational (client_id, name, operational_guard),
  ADD CONSTRAINT fk_schedule_sessions_deleter FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT;

ALTER TABLE schedule_week_templates
  MODIFY status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
  ADD COLUMN deleted_at TIMESTAMP NULL,
  ADD COLUMN deleted_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN operational_guard TINYINT GENERATED ALWAYS AS (CASE WHEN status <> 'deleted' THEN 1 ELSE NULL END) STORED,
  DROP INDEX uq_schedule_weeks_name,
  ADD UNIQUE KEY uq_schedule_weeks_operational (client_id, name, operational_guard),
  ADD CONSTRAINT fk_schedule_weeks_deleter FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE RESTRICT;
