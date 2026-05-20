-- Migration 011: Todo list cá nhân + category
-- - todo_category: phân loại đầu việc (admin quản lý)
-- - todo_task:     đầu việc, mỗi user xem task mình làm + task mình giao
-- Hỗ trợ gán cho user khác và optional liên kết 1 công nhân cụ thể.

BEGIN;

CREATE TABLE IF NOT EXISTS todo_category (
  id          SERIAL PRIMARY KEY,
  ten         VARCHAR(100) NOT NULL,
  icon        VARCHAR(20),                       -- emoji ngắn (tuỳ chọn)
  mau_sac     VARCHAR(20),                       -- token màu (vd 'accent', 'green', 'amber')
  thu_tu      SMALLINT NOT NULL DEFAULT 100,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_todo_cat_active ON todo_category(active);

DROP TRIGGER IF EXISTS trg_todo_cat_updated_at ON todo_category;
CREATE TRIGGER trg_todo_cat_updated_at BEFORE UPDATE ON todo_category
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

INSERT INTO todo_category (ten, icon, mau_sac, thu_tu) VALUES
  ('Đón công nhân mới xuống',    '🚌', 'accent', 10),
  ('Đón công nhân ra công ty',    '🏭', 'teal',   20),
  ('Đón công nhân về',            '🏠', 'amber',  30),
  ('Mua đồ cho công nhân',        '🛒', 'green',  40),
  ('Khác',                        '📝', 'text2',  99)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS todo_task (
  id            SERIAL PRIMARY KEY,
  tieu_de       VARCHAR(300) NOT NULL,
  mo_ta         TEXT,
  category_id   INT REFERENCES todo_category(id) ON DELETE SET NULL,
  -- assignee: người làm; created_by: người tạo
  assignee_id   INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_by    INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Optional: liên kết tới 1 CN cụ thể
  cong_nhan_id  INT REFERENCES cong_nhan(id) ON DELETE SET NULL,
  han           DATE,
  hoan_thanh    BOOLEAN NOT NULL DEFAULT FALSE,
  hoan_thanh_at TIMESTAMPTZ,
  hoan_thanh_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_todo_assignee   ON todo_task(assignee_id);
CREATE INDEX IF NOT EXISTS idx_todo_created_by ON todo_task(created_by);
CREATE INDEX IF NOT EXISTS idx_todo_hoan_thanh ON todo_task(hoan_thanh);
CREATE INDEX IF NOT EXISTS idx_todo_category   ON todo_task(category_id);
CREATE INDEX IF NOT EXISTS idx_todo_cong_nhan  ON todo_task(cong_nhan_id);

DROP TRIGGER IF EXISTS trg_todo_task_updated_at ON todo_task;
CREATE TRIGGER trg_todo_task_updated_at BEFORE UPDATE ON todo_task
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

COMMIT;
