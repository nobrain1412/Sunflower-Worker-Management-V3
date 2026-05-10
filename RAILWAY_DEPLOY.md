# Hướng dẫn Deploy WorkerOS lên Railway

## Chuẩn bị

1. Tài khoản Railway: https://railway.app
2. Railway CLI (tuỳ chọn): `npm install -g @railway/cli`
3. Dự án đã được push lên GitHub

---

## Các bước deploy

### Bước 1 — Push code lên GitHub

```bash
git init                        # nếu chưa có git
git add .
git commit -m "chore: cấu hình Railway deploy"
git remote add origin https://github.com/<username>/workeros.git
git push -u origin main
```

### Bước 2 — Tạo project trên Railway

1. Vào https://railway.app → **New Project**
2. Chọn **Deploy from GitHub repo** → chọn repo `workeros`
3. Railway sẽ tự detect và bắt đầu build

### Bước 3 — Thêm PostgreSQL

1. Trong Railway project → **+ New** → **Database** → **Add PostgreSQL**
2. Railway tự tạo `DATABASE_URL` và inject vào service

### Bước 4 — Cấu hình Environment Variables

Vào **Service → Variables**, thêm các biến sau:

```
NODE_ENV=production
PORT=3000

# JWT (tạo chuỗi random 64 ký tự)
JWT_SECRET=<random_64_chars>
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_SECRET=<random_64_chars_khác>
REFRESH_TOKEN_EXPIRES_IN=30d

# CORS — điền URL Railway của bạn (sau khi có domain)
CORS_ORIGIN=https://<your-app>.up.railway.app

# DATABASE_URL được Railway tự inject từ PostgreSQL plugin
# Không cần thêm thủ công
```

> Tạo JWT secret nhanh: chạy lệnh `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

### Bước 5 — Chạy Migration Database

Sau khi deploy thành công lần đầu, chạy migration từ Railway shell:

**Cách 1 — Railway CLI:**
```bash
railway login
railway link                    # link với project
railway run npm run migrate     # chạy migration
```

**Cách 2 — Railway Dashboard:**
1. Vào Service → **Deploy** tab
2. Click **Open Shell**
3. Chạy: `cd backend && node src/utils/migrate.js`

### Bước 6 — Lấy URL Public

1. Vào Service → **Settings** → **Networking**
2. Click **Generate Domain** để có URL dạng `https://workeros-xxx.up.railway.app`
3. Cập nhật `CORS_ORIGIN` với URL này

---

## Kiểm tra deploy

```bash
# Health check
curl https://<your-app>.up.railway.app/health

# Kết quả mong đợi:
# {"status":"ok","ts":"2026-..."}
```

---

## Cấu trúc deploy

```
Railway Service (Node.js)
├── Build: npm ci (frontend) → vite build → npm ci (backend)
├── Start: node backend/src/server.js
│   ├── /api/*         → Express routes
│   ├── /uploads/*     → Static files
│   └── /*             → React SPA (frontend/dist)
│
└── Railway PostgreSQL Plugin
    └── DATABASE_URL → tự động inject
```

---

## Lưu ý quan trọng

- **Uploads folder**: File ảnh upload sẽ mất sau mỗi redeploy (Railway không có persistent disk miễn phí). Cân nhắc dùng Cloudinary hoặc S3 cho production thực sự.
- **Logs**: Xem tại Railway Dashboard → Service → Logs
- **Redeploy**: Push code mới lên GitHub → Railway tự deploy lại
