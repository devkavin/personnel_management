ALTER TABLE clients
  ADD COLUMN user_identifier_label VARCHAR(80) NOT NULL DEFAULT 'User ID',
  ADD COLUMN new_user_identifier_label VARCHAR(80) NOT NULL DEFAULT 'New User ID';

ALTER TABLE users
  ADD COLUMN user_identifier VARCHAR(80) NULL,
  ADD COLUMN new_user_identifier VARCHAR(80) NULL,
  ADD UNIQUE KEY uq_users_user_identifier (user_identifier),
  ADD UNIQUE KEY uq_users_new_user_identifier (new_user_identifier);
