ALTER TABLE users
  ADD COLUMN timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Colombo' AFTER status;
