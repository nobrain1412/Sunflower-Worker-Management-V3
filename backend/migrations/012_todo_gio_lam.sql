-- Migration 012: Thêm giờ làm vào todo_task
BEGIN;
ALTER TABLE todo_task ADD COLUMN IF NOT EXISTS gio_lam VARCHAR(5);  -- HH:MM
COMMIT;
