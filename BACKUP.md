# Backup & Restore DB

Hệ thống backup tự động cho WorkerOS, chạy trên Railway.

---

## Tổng quan

- **Storage**: Railway Volume mount tại `/data/backups` trên backend service `Sunflower-Worker-Management-V3`
- **Format**: `pg_dump --no-owner --no-acl` → gzip → `dump-YYYYMMDD-HHMMSS-<reason>.sql.gz`
- **Retention**: giữ **20 bản gần nhất**, tự xoá bản cũ (đổi bằng env `BACKUP_KEEP`)
- **Trigger**: tự động mỗi lần deploy + chạy được thủ công bất cứ lúc nào

Files liên quan:
- [backend/src/utils/backup.js](backend/src/utils/backup.js) — logic chính
- [backend/src/utils/backup-now.js](backend/src/utils/backup-now.js) — CLI chạy thủ công
- [backend/src/utils/migrate.js](backend/src/utils/migrate.js) — gọi backup trước khi áp migration

---

## Backup tự động khi deploy

Mỗi lần `npm start` chạy (= mỗi lần Railway deploy hoặc restart container):

1. `migrate.js` xác định có migration pending không
2. Gọi `runBackup()` → `pg_dump | gzip` → ghi vào `/data/backups/`
3. Prune giữ 20 bản gần nhất
4. Áp migration (nếu có)

**Quy tắc fail-safe:**

| Có migration pending? | Backup fail? | Behavior |
|---|---|---|
| Có | Fail | **ABORT deploy** — không áp migration để bảo vệ dữ liệu |
| Có | OK | Backup `pre-migrate` → áp migration |
| Không | Fail | Warning, vẫn cho start (vì không sửa schema) |
| Không | OK | Backup `deploy` (snapshot định kỳ) |

Để **bắt buộc** backup phải thành công kể cả khi không có migration:

```
REQUIRE_BACKUP=true
```

→ Set trong Railway → backend service → Variables.

---

## Backup thủ công

### Cách 1: Railway dashboard (one-off command)

1. Railway → service backend → `...` menu → **Run a command**
2. Nhập: `npm run backup --prefix backend`
3. Bấm Run → command chạy trong container production

### Cách 2: Railway CLI

Cài 1 lần:
```bash
npm i -g @railway/cli
railway login
railway link        # chọn project lucid-heart
```

Chạy backup:
```bash
railway run --service Sunflower-Worker-Management-V3 npm run backup --prefix backend
```

Backup với reason tuỳ chỉnh (giúp nhận diện file):
```bash
railway run --service Sunflower-Worker-Management-V3 \
  npm run backup --prefix backend -- truoc-khi-sua-luong
```
→ Tạo file `dump-20260520-153045-truoc-khi-sua-luong.sql.gz`

### Cách 3: Local (với DB Railway)

```bash
DATABASE_URL="<lấy từ Railway Postgres → Variables>" \
BACKUP_DIR="./backups-local" \
npm run backup --prefix backend
```

⚠️ Cần `pg_dump` v18+ cài sẵn trên máy local. Nếu không, dùng cách 1 hoặc 2.

### Khi nào nên backup thủ công

- Trước khi vào Railway DB chạy SQL `UPDATE` / `DELETE` / `TRUNCATE` bằng tay
- Trước khi đổi mật khẩu, role, permission hàng loạt
- Sau khi nhập xong lô dữ liệu lớn (cần mốc snapshot)
- Khi deploy auto-backup bị fail (xem log Deploy)
- Trước khi test feature có nguy cơ ảnh hưởng dữ liệu

---

## Xem danh sách backup

### Qua Railway dashboard

`...` menu → **Run a command** → `npm run backup:list --prefix backend`

### Qua CLI

```bash
railway run --service Sunflower-Worker-Management-V3 npm run backup:list --prefix backend
```

Output ví dụ:
```
-rw-r--r-- 1 root root 87K May 20 03:15 dump-20260520-031518-pre-migrate.sql.gz
-rw-r--r-- 1 root root 86K May 19 17:03 dump-20260519-170318-deploy.sql.gz
```

---

## Restore từ backup

⚠️ **Restore sẽ ghi đè dữ liệu hiện tại.** Đọc kỹ trước khi chạy.

### Cách an toàn nhất: restore vào DB nhánh (branch)

Railway hỗ trợ tạo branch DB từ snapshot. **Khuyến nghị dùng để test trước:**

1. Railway → Postgres service → tab **Backups** → tạo backup tự động (snapshot)
2. Tạo branch từ snapshot
3. Trỏ một backend staging vào branch DB → verify dữ liệu OK
4. Nếu OK → promote branch thành main, hoặc thay `DATABASE_URL` của backend production

### Cách restore trực tiếp (emergency)

1. **BACKUP HIỆN TẠI TRƯỚC** — phòng khi restore lại sai:
   ```bash
   railway run --service Sunflower-Worker-Management-V3 \
     npm run backup --prefix backend -- truoc-khi-restore
   ```

2. SSH vào container (Railway CLI):
   ```bash
   railway shell --service Sunflower-Worker-Management-V3
   ```

3. Trong shell, xem danh sách backup và chọn file:
   ```bash
   ls -lh /data/backups
   ```

4. Restore (ghi đè DB hiện tại):
   ```bash
   gunzip -c /data/backups/dump-YYYYMMDD-HHMMSS-xxx.sql.gz | psql $DATABASE_URL
   ```

5. Verify dữ liệu qua app. Nếu sai → restore tiếp từ `truoc-khi-restore.sql.gz`.

### Cách restore từ máy local

Download backup từ Railway về máy (qua `railway shell` + `scp`, hoặc tạm copy ra Cloudinary), rồi:
```bash
gunzip -c dump-xxx.sql.gz | psql "<DATABASE_URL>"
```

---

## Configuration

Env vars (set trong Railway → backend service → Variables):

| Variable | Default | Mô tả |
|---|---|---|
| `BACKUP_DIR` | `/data/backups` | Đường dẫn lưu backup (phải nằm trên volume) |
| `BACKUP_KEEP` | `20` | Số bản backup giữ lại, prune phần dư |
| `REQUIRE_BACKUP` | `false` | `true` = abort deploy nếu backup fail kể cả khi không có migration |

---

## Setup ban đầu (chỉ làm 1 lần)

Nếu deploy lần đầu hoặc chuyển project sang Railway mới:

### 1. Mount Volume

1. Railway → service `Sunflower-Worker-Management-V3` (backend)
2. Settings → **Volumes** → **+ New Volume**
3. Mount Path: `/data`
4. Size: tối thiểu **1 GB**, đề xuất **5-10 GB** cho production (DB 200MB → backup 50MB nén → 20 bản = 1 GB)
5. Save → service tự restart

### 2. Verify pg_dump version

Trong [nixpacks.toml](nixpacks.toml):
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "postgresql_18"]
```

`postgresql_18` phải **khớp hoặc lớn hơn** version của Railway Postgres. Check version server:

```sql
SELECT version();
```

Nếu Railway upgrade Postgres lên 19 → đổi thành `postgresql_19` rồi push.

### 3. Verify lần deploy đầu

Trong **Deploy Logs**, tìm:
```
📦 Backup DB → /data/backups/dump-20260520-...-deploy.sql.gz
✓ Backup xong: dump-...-deploy.sql.gz (xx KB)
  Giữ N bản backup gần nhất tại /data/backups
```

---

## Troubleshooting

### `⚠ Không tạo được thư mục /data/backups`

→ Volume chưa mount đúng. Vào Settings → Volumes, kiểm tra Mount Path = `/data` và service đã restart sau khi mount.

### `pg_dump: aborting because of server version mismatch`

```
server version: 18.3
pg_dump version: 17.6
```

→ pg_dump trong nixpacks cũ hơn Postgres server. Mở [nixpacks.toml](nixpacks.toml), update `postgresql_NN` cho match với server.

### `pg_dump: command not found`

→ Nixpacks chưa cài postgresql. Kiểm tra `nixPkgs` trong [nixpacks.toml](nixpacks.toml) có `postgresql_18` chưa, rebuild image (push commit để trigger).

### Backup quá lớn, volume đầy

→ Tăng size volume: Settings → Volumes → click volume → **Live resize** (Railway hỗ trợ tăng size không downtime).

Hoặc giảm retention: set `BACKUP_KEEP=10` trong Variables.

### Muốn skip backup tạm thời (emergency deploy)

→ Set `REQUIRE_BACKUP=false` (default đã là false) + không có migration pending → backup fail sẽ chỉ warn, deploy vẫn chạy.

### `npm run backup` báo `DATABASE_URL không có`

→ Bạn đang chạy local không có .env. Set biến trước khi chạy:
```bash
DATABASE_URL="postgres://..." npm run backup --prefix backend
```

---

## Disaster recovery checklist

Khi có sự cố mất dữ liệu:

1. ☐ **Dừng tiếp tục thao tác** — đừng làm gì có thể ghi DB nữa
2. ☐ Bật bảo trì (cho user biết app đang offline)
3. ☐ Backup state hiện tại (corrupt) — `npm run backup -- corrupted-state`
4. ☐ Xem `npm run backup:list` chọn bản backup gần nhất trước sự cố
5. ☐ **Test restore vào DB branch** (Railway → Postgres → Branches)
6. ☐ Verify dữ liệu OK trên branch
7. ☐ Swap `DATABASE_URL` production sang branch (hoặc restore vào main DB)
8. ☐ Tắt bảo trì, thông báo user

Quan trọng: **tạo branch DB và verify trước** thay vì restore thẳng vào main DB. Mất 5 phút nhưng tránh được trường hợp restore nhầm bản còn sai hơn hiện tại.
