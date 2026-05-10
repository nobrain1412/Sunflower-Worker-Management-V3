-- Migration 002: Seed user admin duy nhất.
-- Mật khẩu mặc định: Admin@123 — đổi ngay sau khi đăng nhập lần đầu.
-- Hash bcrypt cost=10.

INSERT INTO users (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro, active)
VALUES (
  'admin',
  '$2a$10$Ow1ZhVGJy/fOs/NAwrP0de4zEQGnHbpakHPBdfx0DlaOXvSvVw0kW',
  'Quản trị viên',
  'admin',
  TRUE
)
ON CONFLICT (ten_dang_nhap) DO NOTHING;
