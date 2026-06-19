/**
 * Seed dữ liệu demo liên kết đầy đủ — populate MỌI field của schema mới nhất.
 *
 * Phạm vi:
 * - 10 users (1 admin + 1 ke_toan + 4 quan_ly + 3 vender + 1 ctv)
 * - 10 công ty (đủ map_url, media_urls, ghi_chu, mô tả công việc, cấu hình lương)
 * - 3 KTX × 6 phòng × 6 giường (kèm media_urls + ghi_chu)
 * - 8 phòng trọ (đủ map_url, media_urls, tài khoản ngân hàng chủ trọ)
 * - 50 công nhân: mọi field (ma_van_tay, ảnh CCCD/chân dung, ảnh xe khi mượn,
 *   ngay_nghi_viec khi nghỉ việc, trang_thai_noi_o khớp với assignment)
 * - Tài chính: random thu/chi/tiêu + đánh dấu da_hoan_tien + ngay_hoan
 * - Thanh toán CTV: cả 2 hình thức 'mot_lan' và 'hang_thang'
 * - OCR logs: 80 bản, mix cccd/danh_sach và cho_duyet/da_duyet/tu_choi
 * - KHÔNG seed bảng cham_cong (theo yêu cầu)
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

const PASSWORDS = {
  admin: 'Admin@123',
  quan_ly: 'QL@123',
  vender: 'VD@123',
  ke_toan: 'KT@123',
  cong_tac_vien: 'CTV@123',
};

const LAST_NAMES = ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vo', 'Dang', 'Bui', 'Do', 'Ngo'];
const MIDDLE_NAMES = ['Van', 'Thi', 'Minh', 'Duc', 'Quoc', 'Thanh', 'Gia', 'Anh', 'Bao', 'Thuy'];
const FIRST_NAMES = ['An', 'Binh', 'Chi', 'Dung', 'Hieu', 'Khanh', 'Linh', 'Nam', 'Phuong', 'Quynh'];
const PROVINCES = ['Ha Noi', 'Hai Duong', 'Nghe An', 'Da Nang', 'Quang Nam', 'Binh Dinh', 'Khanh Hoa', 'Dong Nai', 'Can Tho', 'An Giang'];
const BANKS = ['Vietcombank', 'BIDV', 'VietinBank', 'Techcombank', 'ACB', 'MB', 'TPBank'];
const RETRYABLE_ERRORS = ['ETIMEDOUT', 'ECONNRESET', 'EPIPE', 'ENOTFOUND', '57P01', '40001'];

// Cloudinary demo bucket — public, không cần auth, được allow trong CSP
const DEMO_IMG = (seed) => `https://res.cloudinary.com/demo/image/upload/v1/sample.jpg?${seed}`;
const DEMO_ID_FRONT  = (seed) => `https://res.cloudinary.com/demo/image/upload/v1/sample.jpg?cccd_truoc_${seed}`;
const DEMO_ID_BACK   = (seed) => `https://res.cloudinary.com/demo/image/upload/v1/sample.jpg?cccd_sau_${seed}`;
const DEMO_PORTRAIT  = (seed) => `https://res.cloudinary.com/demo/image/upload/v1/sample.jpg?chan_dung_${seed}`;
const DEMO_VEHICLE   = (seed) => `https://res.cloudinary.com/demo/image/upload/v1/sample.jpg?xe_${seed}`;
const MAP_EMBED = (q) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;

const SEED_SIZE = {
  managers: 4,
  venders: 3,
  ctv: 1,
  companies: 10,
  workers: 50,
  ktx: 3,
  roomsPerKtx: 6,
  bedsPerRoom: 6,
  phongTro: 8,
};

function pad2(n) { return String(n).padStart(2, '0'); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }
function chance(rate) { return Math.random() < rate; }
function toYmd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function daysAgo(num) { const d = new Date(); d.setDate(d.getDate() - num); return d; }
function addDays(ymd, days) { const d = new Date(ymd); d.setDate(d.getDate() + days); return toYmd(d); }

function fullName(i) {
  return `${LAST_NAMES[i % LAST_NAMES.length]} ${MIDDLE_NAMES[(i * 3) % MIDDLE_NAMES.length]} ${FIRST_NAMES[(i * 7) % FIRST_NAMES.length]}`;
}
function cccd(i) { return String(900000000000 + i); }
function phone(i) { return `0${9 - (i % 4)}${String(10000000 + i).padStart(8, '0')}`.slice(0, 10); }
function accountNo(i) { return String(100000000000 + i); }
function salaryBase(i) { return 5200000 + (i % 8) * 250000; }
function monthInfo(offset) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return { thang: d.getMonth() + 1, nam: d.getFullYear() };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(error) {
  const code = error?.code || '';
  const msg = String(error?.message || '').toLowerCase();
  if (RETRYABLE_ERRORS.includes(code)) return true;
  return msg.includes('timeout') || msg.includes('terminating connection') || (msg.includes('connection') && msg.includes('reset'));
}

async function queryWithRetry(sql, params = [], label = 'query') {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.query(sql, params);
    } catch (error) {
      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }
      console.log(`[retry] ${label} attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      await sleep(1200 * attempt);
    }
  }
  return null;
}

function logPhase(title) {
  console.log(`\n=== ${title} ===`);
}

function logProgress(label, index, total, step = 25) {
  if (index === total || index % step === 0) {
    console.log(`[${label}] ${index}/${total}`);
  }
}

async function createUser(ten_dang_nhap, ho_ten, vai_tro, hash, extra = {}) {
  const r = await queryWithRetry(
    `INSERT INTO users
      (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro, active,
       so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk,
       hinh_thuc_thanh_toan, quan_ly_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      ten_dang_nhap,
      hash,
      ho_ten,
      vai_tro,
      true,
      extra.so_dien_thoai || null,
      extra.ngan_hang || null,
      extra.so_tai_khoan || null,
      extra.ten_chu_tk || null,
      extra.hinh_thuc_thanh_toan || 'mot_lan',
      extra.quan_ly_id || null,
    ],
  );
  return r.rows[0].id;
}

async function seed() {
  // GUARD: chặn TRUNCATE nhầm trên production. Phải set ALLOW_SEED=yes_i_know_this_wipes_data
  // để override (vd: khi cố tình reset DB demo).
  if (process.env.NODE_ENV === 'production'
      && process.env.ALLOW_SEED !== 'yes_i_know_this_wipes_data') {
    console.error('✗ Từ chối seed trên production (NODE_ENV=production).');
    console.error('  Script này TRUNCATE toàn bộ users/cong_nhan/cong_ty/... → MẤT DỮ LIỆU.');
    console.error('  Nếu thực sự muốn chạy: set ALLOW_SEED=yes_i_know_this_wipes_data');
    process.exit(1);
  }

  console.log('Seeding demo data...');
  try {
    await queryWithRetry(`SET lock_timeout = '12s'`, [], 'set lock_timeout');
    await queryWithRetry(`SET statement_timeout = '8min'`, [], 'set statement_timeout');
    await queryWithRetry(`SET idle_in_transaction_session_timeout = '5min'`, [], 'set idle timeout');

    logPhase('Reset database data');
    // Note: TRUNCATE ... CASCADE cascades qua MỌI FK (kể cả danh_muc_giao_dich.user_id
    // mới thêm ở migration 008). Vì vậy ta truncate luôn danh_muc_giao_dich rồi
    // re-insert 12 danh mục mặc định bên dưới để giữ chúng làm system default.
    await queryWithRetry(
      `TRUNCATE TABLE
        refresh_tokens, hoat_dong_log, cham_cong, phan_cong, giao_dich_tai_chinh, hoa_don_ktx,
        thue_phong, giuong, phong, ky_tuc_xa, thue_phong_tro, phong_tro,
        ocr_quet, cong_tac_vien_thanh_toan, user_cong_ty_rate, quan_ly_cong_ty, cong_nhan, cong_ty,
        danh_muc_giao_dich, users
       RESTART IDENTITY CASCADE`,
      [],
      'truncate all tables',
    );

    // Re-insert 12 danh mục thu/chi mặc định hệ thống (user_id NULL)
    await queryWithRetry(
      `INSERT INTO danh_muc_giao_dich (ten, loai) VALUES
        ('Lương','thu'),('Thưởng','thu'),('Phụ cấp','thu'),('Hoàn ứng','thu'),
        ('Khấu trừ','chi'),('Tạm ứng','chi'),('Tiền phòng KTX','chi'),
        ('Bảo hiểm','chi'),('Đồng phục','chi'),('Phạt nghỉ','chi'),
        ('Chi phí lương','tieu'),('Khác','chi')`,
      [],
      'reinsert default danh_muc',
    );

    logPhase('Hash passwords');
    const [hashAdmin, hashQl, hashVender, hashKeToan, hashCtv] = await Promise.all([
      bcrypt.hash(PASSWORDS.admin, 10),
      bcrypt.hash(PASSWORDS.quan_ly, 10),
      bcrypt.hash(PASSWORDS.vender, 10),
      bcrypt.hash(PASSWORDS.ke_toan, 10),
      bcrypt.hash(PASSWORDS.cong_tac_vien, 10),
    ]);

    logPhase('Create users');
    const adminId = await createUser('admin', 'Admin WorkerOS', 'admin', hashAdmin, {
      so_dien_thoai: '0900000000',
      ngan_hang: 'Vietcombank',
      so_tai_khoan: accountNo(1),
      ten_chu_tk: 'ADMIN WORKEROS',
    });
    const keToanId = await createUser('ke_toan', 'Ke Toan Tong', 'ke_toan', hashKeToan, {
      so_dien_thoai: '0900000001',
      ngan_hang: 'BIDV',
      so_tai_khoan: accountNo(2),
      ten_chu_tk: 'KE TOAN TONG',
    });
    const managerIds = [];
    const venderIds = [];
    const ctvIds = [];

    for (let i = 1; i <= SEED_SIZE.managers; i += 1) {
      managerIds.push(await createUser(`ql_${pad2(i)}`, `Quan Ly ${fullName(i)}`, 'quan_ly', hashQl, {
        so_dien_thoai: phone(100 + i),
        ngan_hang: pick(BANKS),
        so_tai_khoan: accountNo(100 + i),
        ten_chu_tk: `QUAN LY ${i}`,
      }));
      logProgress('managers', i, SEED_SIZE.managers, 2);
    }
    for (let i = 1; i <= SEED_SIZE.venders; i += 1) {
      venderIds.push(await createUser(`vender_${pad2(i)}`, `Vender ${fullName(i + 50)}`, 'vender', hashVender, {
        so_dien_thoai: phone(200 + i),
        ngan_hang: pick(BANKS),
        so_tai_khoan: accountNo(200 + i),
        ten_chu_tk: `VENDER ${i}`,
      }));
      logProgress('venders', i, SEED_SIZE.venders, 2);
    }
    for (let i = 1; i <= SEED_SIZE.ctv; i += 1) {
      // CTV được phân về 1 quản lý, hình thức thanh toán xen kẽ
      ctvIds.push(await createUser(`ctv_${pad2(i)}`, `Cong Tac Vien ${fullName(i + 80)}`, 'cong_tac_vien', hashCtv, {
        so_dien_thoai: phone(300 + i),
        ngan_hang: pick(BANKS),
        so_tai_khoan: accountNo(300 + i),
        ten_chu_tk: `CTV ${i}`,
        hinh_thuc_thanh_toan: i % 2 ? 'mot_lan' : 'hang_thang',
        quan_ly_id: managerIds[(i - 1) % managerIds.length],
      }));
      logProgress('ctv', i, SEED_SIZE.ctv, 1);
    }

    logPhase('Create companies');
    const companyRows = [];
    for (let i = 1; i <= SEED_SIZE.companies; i += 1) {
      const ten = `Cong Ty Demo ${pad2(i)}`;
      const diaChi = `${100 + i} Duong Demo, ${pick(PROVINCES)}`;
      const r = await queryWithRetry(
        `INSERT INTO cong_ty
          (ten_cong_ty, dia_chi, map_url, so_dien_thoai, email,
           luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan,
           luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le,
           tien_dong_phuc, tien_phat_nghi,
           tro_cap, chuyen_can, ngay_chot_cong,
           mo_ta_cong_viec, media_urls, ghi_chu, active)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,26,$9,$10,$11,$12,$13,$14,$15,$16,$17,25,$18,$19::jsonb,$20,true)
         RETURNING id, luong_co_ban, luong_theo_gio`,
        [
          ten,
          diaChi,
          MAP_EMBED(diaChi),
          `028${String(1000000 + i).slice(-7)}`,
          `demo${i}@company.vn`,
          salaryBase(i),
          32000 + i * 450,
          1.5 + (i % 3) * 0.25,
          42000 + i * 300,
          28000 + i * 250,
          52000 + i * 350,
          65000 + i * 200,
          90000 + i * 300,
          180000 + i * 12000,
          20000 + i * 1500,
          250000 + i * 12000,
          300000 + i * 15000,
          `Mo ta cong viec cong ty ${i} — ca hanh chinh va tang ca theo nhu cau san xuat.`,
          JSON.stringify([DEMO_IMG(`cty_${i}_a`), DEMO_IMG(`cty_${i}_b`)]),
          `Ghi chu cho cong ty ${i}: doi tac chien luoc.`,
        ],
      );
      companyRows.push(r.rows[0]);
      logProgress('companies', i, SEED_SIZE.companies, 2);
    }
    const companyIds = companyRows.map((r) => r.id);

    logPhase('Seed đơn giá thưởng (user × công ty)');
    // Mỗi vender và CTV được seed đơn giá ở MỌI công ty với mức ngẫu nhiên nhẹ.
    for (const venderId of venderIds) {
      for (let i = 0; i < companyIds.length; i += 1) {
        await queryWithRetry(
          `INSERT INTO user_cong_ty_rate (user_id, cong_ty_id, don_gia_theo_gio, tien_cong_moi_nguoi)
           VALUES ($1,$2,$3,0)
           ON CONFLICT (user_id, cong_ty_id) DO NOTHING`,
          [venderId, companyIds[i], 25000 + (venderId * 1000 + i * 500) % 15000],
          'seed vender rate',
        );
      }
    }
    for (const ctvId of ctvIds) {
      for (let i = 0; i < companyIds.length; i += 1) {
        await queryWithRetry(
          `INSERT INTO user_cong_ty_rate (user_id, cong_ty_id, don_gia_theo_gio, tien_cong_moi_nguoi)
           VALUES ($1,$2,0,$3)
           ON CONFLICT (user_id, cong_ty_id) DO NOTHING`,
          [ctvId, companyIds[i], 100000 + (ctvId * 5000 + i * 2000) % 80000],
          'seed ctv rate',
        );
      }
    }

    logPhase('Assign managers to companies');
    for (let i = 0; i < managerIds.length; i += 1) {
      const c1 = companyIds[i % companyIds.length];
      const c2 = companyIds[(i + 7) % companyIds.length];
      await queryWithRetry(`INSERT INTO quan_ly_cong_ty (user_id, cong_ty_id) VALUES ($1,$2),($1,$3)`, [managerIds[i], c1, c2], 'insert quan_ly_cong_ty');
      logProgress('manager-company links', i + 1, managerIds.length, 5);
    }

    const dmRes = await queryWithRetry(`SELECT id, ten FROM danh_muc_giao_dich`, [], 'select danh_muc');
    const dmMap = Object.fromEntries(dmRes.rows.map((r) => [r.ten, r.id]));
    const thuCategoryNames = ['Lương', 'Thưởng', 'Phụ cấp', 'Hoàn ứng'].filter((name) => dmMap[name]);
    const chiCategoryNames = ['Khấu trừ', 'Tạm ứng', 'Tiền phòng KTX', 'Bảo hiểm', 'Đồng phục', 'Phạt nghỉ', 'Khác'].filter((name) => dmMap[name]);
    const tieuCategoryNames = ['Chi phí lương'].filter((name) => dmMap[name]);

    const workerRows = [];
    const phanCongRows = [];
    const recruiterPool = [adminId, ...managerIds, ...venderIds, ...ctvIds];
    const statusPool = ['dang_lam', 'dang_lam', 'dang_lam', 'moi_vao', 'nghi_phep', 'nghi_viec'];

    logPhase('Create workers + assignments');
    for (let i = 1; i <= SEED_SIZE.workers; i += 1) {
      const recruiterId = recruiterPool[i % recruiterPool.length];
      const companyId = companyIds[(i * 3) % companyIds.length];
      const status = statusPool[i % statusPool.length];
      const ngayVao = toYmd(daysAgo(rand(5, 260)));
      const ngaySinh = toYmd(new Date(rand(1988, 2004), rand(0, 11), rand(1, 28)));
      const ngayCap = toYmd(new Date(rand(2018, 2024), rand(0, 11), rand(1, 28)));
      const gioi_tinh = i % 2 ? 'Nam' : 'Nữ';
      const muonXe = chance(0.45);
      const loaiXe = muonXe ? pick(['xe_dap', 'xe_dien', 'xe_may']) : null;
      const xeDaTra = muonXe ? chance(0.3) : false;
      const ngayMuonXe = muonXe ? addDays(ngayVao, rand(1, 20)) : null;
      const ngayNghiViec = status === 'nghi_viec' ? addDays(ngayVao, rand(30, 200)) : null;
      const r = await queryWithRetry(
        `INSERT INTO cong_nhan
          (ho_ten, cccd, ngay_sinh, gioi_tinh, dia_chi_hien_tai, so_dien_thoai,
           ngay_cap_cccd, trang_thai, ngay_vao_lam, ngay_nghi_viec, ghi_chu,
           nguoi_tuyen_id, cong_ty_id,
           anh_cccd_truoc, anh_cccd_sau, anh_chan_dung, anh_xe,
           da_tra_dong_phuc, da_viet_don_nghi,
           ngan_hang, so_tai_khoan, ten_chu_tk,
           cccd_da_tra, trang_thai_noi_o, muon_xe, loai_xe, xe_da_tra, ngay_muon_xe,
           ma_van_tay)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
           $14,$15,$16,$17,
           $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
         RETURNING id, ngay_vao_lam, cong_ty_id, nguoi_tuyen_id, trang_thai, muon_xe`,
        [
          fullName(i),
          cccd(i),
          ngaySinh,
          gioi_tinh,
          `${rand(1, 999)} Khu pho ${rand(1, 20)}, ${pick(PROVINCES)}`,
          phone(500 + i),
          ngayCap,
          status,
          ngayVao,
          ngayNghiViec,
          `Ghi chu demo cong nhan ${i}`,
          recruiterId,
          companyId,
          DEMO_ID_FRONT(i),
          DEMO_ID_BACK(i),
          DEMO_PORTRAIT(i),
          muonXe ? DEMO_VEHICLE(i) : null,
          chance(0.7),
          chance(0.25),
          pick(BANKS),
          accountNo(500 + i),
          `CONG NHAN ${i}`,
          chance(0.35),
          'chua_co_phong', // tạm — sẽ update lại sau khi assign KTX/phòng trọ
          muonXe,
          loaiXe,
          xeDaTra,
          ngayMuonXe,
          `VT${pad2(i)}${rand(100, 999)}`,
        ],
      );
      workerRows.push(r.rows[0]);

      const pc = await queryWithRetry(
        `INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau, ghi_chu)
         VALUES ($1,$2,$3,$4)
         RETURNING id, cong_nhan_id`,
        [r.rows[0].id, companyId, ngayVao, 'Phan cong seed'],
      );
      phanCongRows.push(pc.rows[0]);
      logProgress('workers', i, SEED_SIZE.workers, 10);
    }

    logPhase('Create attendance (cham_cong) — 60 ngay gan nhat');
    // Query lại phan_cong từ DB để chắc chắn có id và ngay_bat_dau đúng kiểu
    const pcMetaRes = await queryWithRetry(
      `SELECT pc.id, pc.cong_nhan_id, pc.ngay_bat_dau, cn.trang_thai, cn.ngay_nghi_viec
       FROM phan_cong pc JOIN cong_nhan cn ON cn.id = pc.cong_nhan_id
       ORDER BY pc.id`,
      [],
      'fetch phan_cong meta',
    );
    const pcList = pcMetaRes.rows;
    const todayStr = toYmd(new Date());
    let ccCount = 0, ccErrors = 0;
    for (let idx = 0; idx < pcList.length; idx += 1) {
      const pc = pcList[idx];
      // Skip 30% CN đã nghỉ việc
      if (pc.trang_thai === 'nghi_viec' && chance(0.3)) continue;

      const startStr = toYmd(new Date(pc.ngay_bat_dau));
      const endStr   = pc.ngay_nghi_viec ? toYmd(new Date(pc.ngay_nghi_viec)) : todayStr;

      for (let dOffset = 60; dOffset >= 0; dOffset -= 1) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - dOffset);
        const dateStr = toYmd(d);
        if (dateStr < startStr || dateStr > endStr) continue;

        const dow = d.getDay();
        if (dow === 0 && chance(0.7)) continue;
        if (dow === 6 && chance(0.3)) continue;

        const r = Math.random();
        let entry;
        if (r < 0.05) {
          entry = { so_gio: 0, so_gio_ot: 0, ca_lam: 'nghi_phep' };
        } else if (r < 0.15) {
          continue;
        } else if (r < 0.35) {
          entry = { so_gio: 8, so_gio_ot: rand(1, 4), ca_lam: 'lam' };
        } else {
          entry = { so_gio: 8, so_gio_ot: 0, ca_lam: 'lam' };
        }
        try {
          await queryWithRetry(
            `INSERT INTO cham_cong (phan_cong_id, ngay, so_gio, so_gio_ot, ca_lam, ghi_chu)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (phan_cong_id, ngay) DO NOTHING`,
            [pc.id, dateStr, entry.so_gio, entry.so_gio_ot, entry.ca_lam, null],
            'insert cham_cong',
          );
          ccCount += 1;
        } catch (e) {
          ccErrors += 1;
          if (ccErrors <= 3) console.warn(`  cham_cong err: ${e.message}`);
        }
      }
      logProgress('cham_cong', idx + 1, pcList.length, 10);
    }
    console.log(`[cham_cong] inserted ${ccCount}, errors ${ccErrors}`);

    logPhase('Create KTX / rooms / beds');
    const roomRows = [];
    const bedRows = [];
    for (let k = 1; k <= SEED_SIZE.ktx; k += 1) {
      const ten = `KTX ${pad2(k)}`;
      const diaChi = `${200 + k} Duong KTX, ${pick(PROVINCES)}`;
      const ktx = await queryWithRetry(
        `INSERT INTO ky_tuc_xa (ten, dia_chi, ghi_chu, media_urls, active)
         VALUES ($1,$2,$3,$4::jsonb,true) RETURNING id`,
        [
          ten,
          diaChi,
          `KTX demo ${k} — gan khu cong nghiep.`,
          JSON.stringify([DEMO_IMG(`ktx_${k}_a`), DEMO_IMG(`ktx_${k}_b`), DEMO_IMG(`ktx_${k}_c`)]),
        ],
      );
      for (let r = 1; r <= SEED_SIZE.roomsPerKtx; r += 1) {
        const room = await queryWithRetry(
          `INSERT INTO phong (ktx_id, ten_phong, tang, suc_chua, tien_phong, ghi_chu, active)
           VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING id, tien_phong`,
          [ktx.rows[0].id, `P${k}${pad2(r)}`, 1 + Math.floor((r - 1) / 3), 6, 1500000 + r * 80000, `Phong demo P${k}${pad2(r)}`],
        );
        roomRows.push(room.rows[0]);
        for (let b = 1; b <= SEED_SIZE.bedsPerRoom; b += 1) {
          const bed = await queryWithRetry(
            `INSERT INTO giuong (phong_id, so_thu_tu, ghi_chu) VALUES ($1,$2,$3) RETURNING id, phong_id`,
            [room.rows[0].id, b, `Giuong ${b}`],
          );
          bedRows.push(bed.rows[0]);
        }
      }
      logProgress('ktx', k, SEED_SIZE.ktx, 1);
    }

    logPhase('Create external hostels (phong_tro)');
    const phongTroIds = [];
    for (let i = 1; i <= SEED_SIZE.phongTro; i += 1) {
      const ten = `Nha tro ${pad2(i)}`;
      const diaChi = `${300 + i} Duong Tro, ${pick(PROVINCES)}`;
      const pt = await queryWithRetry(
        `INSERT INTO phong_tro
          (ten, dia_chi, map_url, chu_tro, sdt_chu_tro, so_phong, tien_phong, ghi_chu,
           ngan_hang, so_tai_khoan, ten_chu_tk, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true) RETURNING id`,
        [
          ten,
          diaChi,
          MAP_EMBED(diaChi),
          `Chu tro ${i}`,
          phone(700 + i),
          rand(8, 24),
          2300000 + i * 50000,
          `Nha tro demo ${i} — gan cho, an toan.`,
          pick(BANKS),
          accountNo(800 + i),
          `CHU TRO ${i}`,
        ],
      );
      const ptId = pt.rows[0].id;
      // Update media_urls riêng vì cột chỉ có sau migration 005
      await queryWithRetry(
        `UPDATE phong_tro SET media_urls = $2::jsonb WHERE id = $1`,
        [ptId, JSON.stringify([DEMO_IMG(`pt_${i}_a`), DEMO_IMG(`pt_${i}_b`)])],
        'update phong_tro media',
      );
      phongTroIds.push(ptId);
      logProgress('phong_tro', i, SEED_SIZE.phongTro, 2);
    }

    logPhase('Assign workers to KTX beds');
    const activeWorkers = workerRows.filter((w) => w.trang_thai !== 'nghi_viec');
    // Chia 70/30: ~70% vao KTX, ~30% vao phong tro de demo ca 2 module
    const ktxQuota = Math.min(Math.floor(activeWorkers.length * 0.7), bedRows.length);
    const ktxWorkers = activeWorkers.slice(0, ktxQuota);
    for (let i = 0; i < ktxWorkers.length; i += 1) {
      const w = ktxWorkers[i];
      const bed = bedRows[i];
      await queryWithRetry(
        `INSERT INTO thue_phong (cong_nhan_id, giuong_id, ngay_vao, ghi_chu)
         VALUES ($1,$2,$3,$4)`,
        [w.id, bed.id, addDays(w.ngay_vao_lam, rand(0, 10)), 'Thue giuong demo'],
      );
      await queryWithRetry(
        `UPDATE cong_nhan SET trang_thai_noi_o = 'ktx' WHERE id = $1`,
        [w.id],
        'update cong_nhan trang_thai_noi_o ktx',
      );
      logProgress('thue_phong', i + 1, ktxWorkers.length, 30);
    }

    logPhase('Assign workers to hostels');
    const troWorkers = activeWorkers.slice(ktxWorkers.length);
    for (let i = 0; i < troWorkers.length; i += 1) {
      const w = troWorkers[i];
      await queryWithRetry(
        `INSERT INTO thue_phong_tro (cong_nhan_id, phong_tro_id, ngay_vao, ghi_chu)
         VALUES ($1,$2,$3,$4)`,
        [w.id, phongTroIds[i % phongTroIds.length], addDays(w.ngay_vao_lam, rand(5, 20)), 'Thue phong tro demo'],
      );
      await queryWithRetry(
        `UPDATE cong_nhan SET trang_thai_noi_o = 'phong_tro' WHERE id = $1`,
        [w.id],
        'update cong_nhan trang_thai_noi_o phong_tro',
      );
      logProgress('thue_phong_tro', i + 1, troWorkers.length, 20);
    }

    // Một số công nhân chưa active được set 'tu_tuc' để có data đầy đủ
    await queryWithRetry(
      `UPDATE cong_nhan SET trang_thai_noi_o = 'tu_tuc'
       WHERE trang_thai = 'nghi_viec' AND id IN (
         SELECT id FROM cong_nhan WHERE trang_thai = 'nghi_viec' LIMIT 5
       )`,
      [],
      'set tu_tuc for some nghi_viec',
    );

    logPhase('Create KTX invoices');
    const m0 = monthInfo(0);
    const m1 = monthInfo(1);
    for (const room of roomRows) {
      const baseDien = rand(1500, 2600);
      const baseNuoc = rand(220, 420);
      for (const m of [m1, m0]) {
        const dienCu = baseDien + (m === m0 ? 80 : 0);
        const nuocCu = baseNuoc + (m === m0 ? 15 : 0);
        await queryWithRetry(
          `INSERT INTO hoa_don_ktx
            (phong_id, thang, nam, dien_cu, dien_moi, don_gia_dien, nuoc_cu, nuoc_moi, don_gia_nuoc, tien_phong, ghi_chu)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [room.id, m.thang, m.nam, dienCu, dienCu + rand(35, 70), 3200, nuocCu, nuocCu + rand(8, 20), 17000, room.tien_phong, `Hoa don T${m.thang}/${m.nam}`],
        );
      }
    }
    console.log(`[hoa_don_ktx] inserted ${roomRows.length * 2}`);

    logPhase('Create finance transactions');
    let gdtcCount = 0;
    for (const w of workerRows) {
      // Không bắt buộc công nhân nào cũng có giao dịch.
      if (chance(0.28)) continue;

      const txCount = rand(1, 4);
      for (let i = 0; i < txCount; i += 1) {
        const loai = pick(['thu', 'chi', 'tieu']);
        const categoryPool = loai === 'thu'
          ? thuCategoryNames
          : loai === 'chi'
            ? chiCategoryNames
            : tieuCategoryNames;
        if (!categoryPool.length) continue;

        const categoryName = pick(categoryPool);
        const danhMucId = dmMap[categoryName];
        const soTien = loai === 'thu'
          ? rand(300000, 6500000)
          : loai === 'chi'
            ? rand(150000, 2800000)
            : rand(200000, 3500000);

        const note = loai === 'thu'
          ? pick(['Thu tiền lương', 'Thu thưởng', 'Thu phụ cấp', 'Hoàn ứng'])
          : loai === 'chi'
            ? pick(['Chi bảo hiểm', 'Khấu trừ tạm ứng', 'Chi đồng phục', 'Chi tiền phòng'])
            : pick(['Tiêu hao vật tư', 'Chi phí lương', 'Chi phí vận hành']);

        const ngay = toYmd(daysAgo(rand(2, 90)));
        const daHoan = loai === 'chi' && categoryName === 'Tạm ứng' ? chance(0.4) : false;
        const ngayHoan = daHoan ? addDays(ngay, rand(5, 30)) : null;

        await queryWithRetry(
          `INSERT INTO giao_dich_tai_chinh
            (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu, created_by, da_hoan_tien, ngay_hoan)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            w.id,
            danhMucId,
            loai,
            soTien,
            ngay,
            `${note} (${categoryName})`,
            pick([keToanId, adminId, w.nguoi_tuyen_id || adminId]),
            daHoan,
            ngayHoan,
          ],
        );
        gdtcCount += 1;
      }

      if (gdtcCount % 200 === 0) {
        console.log(`[giao_dich_tai_chinh] inserted ${gdtcCount}`);
      }
    }
    console.log(`[giao_dich_tai_chinh] inserted total ${gdtcCount}`);

    logPhase('Create CTV thanh toan');
    // Mỗi công nhân do CTV tuyển → tạo bản ghi thanh toán (mỗi CN chỉ 1 mot_lan hoặc 1 hang_thang/tháng)
    const ctvWorkers = workerRows.filter((w) => ctvIds.includes(w.nguoi_tuyen_id));
    let ctvTtCount = 0;
    for (const w of ctvWorkers) {
      const hinhThuc = chance(0.5) ? 'mot_lan' : 'hang_thang';
      if (hinhThuc === 'mot_lan') {
        await queryWithRetry(
          `INSERT INTO cong_tac_vien_thanh_toan
            (ctv_id, cong_nhan_id, hinh_thuc, thang, nam, so_tien, ghi_chu, created_by)
           VALUES ($1,$2,'mot_lan',NULL,NULL,$3,$4,$5)`,
          [w.nguoi_tuyen_id, w.id, 150000 + rand(0, 60) * 1000, 'Thuong tuyen CN', adminId],
        );
        ctvTtCount += 1;
      } else {
        // 2-3 tháng gần nhất
        for (const offset of [2, 1, 0]) {
          const m = monthInfo(offset);
          const soTien = 80000 + rand(20, 80) * 1000;
          try {
            await queryWithRetry(
              `INSERT INTO cong_tac_vien_thanh_toan
                (ctv_id, cong_nhan_id, hinh_thuc, thang, nam, so_tien, ghi_chu, created_by)
               VALUES ($1,$2,'hang_thang',$3,$4,$5,$6,$7)`,
              [w.nguoi_tuyen_id, w.id, m.thang, m.nam, soTien, `Thanh toan T${m.thang}/${m.nam}`, adminId],
            );
            ctvTtCount += 1;
          } catch (e) {
            // unique constraint có thể skip nếu trùng
            if (!String(e.message || '').includes('unique')) throw e;
          }
        }
      }
    }
    console.log(`[cong_tac_vien_thanh_toan] inserted ${ctvTtCount}`);

    logPhase('Create OCR logs');
    for (let i = 0; i < 80; i += 1) {
      const creatorPool = [adminId, ...managerIds, ...venderIds];
      const creator = creatorPool[i % creatorPool.length];
      // 3 trạng thái: 0=cho_duyet, 1=da_duyet, 2=tu_choi
      const trangThai = i % 3 === 0 ? 'cho_duyet' : (i % 3 === 1 ? 'da_duyet' : 'tu_choi');
      const worker = workerRows[i % workerRows.length];
      await queryWithRetry(
        `INSERT INTO ocr_quet (loai, duong_dan_anh, ket_qua_json, trang_thai, created_by, cong_nhan_id, ghi_chu)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          i % 4 === 0 ? 'danh_sach' : 'cccd',
          DEMO_IMG(`ocr_${i + 1}`),
          JSON.stringify({ index: i + 1, ho_ten: worker.id, source: 'seed' }),
          trangThai,
          creator,
          trangThai === 'da_duyet' ? worker.id : null,
          trangThai === 'da_duyet' ? 'Duyet tu dong seed' : (trangThai === 'tu_choi' ? 'Anh mo, can chup lai' : 'Cho duyet demo'),
        ],
      );
      logProgress('ocr_quet', i + 1, 80, 20);
    }

    logPhase('Create hoat_dong_log');
    // Tao mot vai bao_nghi_phep, chuyen_cong_ty, hoan_ung de timeline + dashboard feed co data
    const hdlTypes = [
      { loai: 'bao_nghi_phep', icon: '🌴', label: 'Báo nghỉ phép' },
      { loai: 'bao_nghi_viec', icon: '🚪', label: 'Báo nghỉ việc' },
      { loai: 'chuyen_cong_ty', icon: '🔄', label: 'Chuyển công ty' },
      { loai: 'chuyen_cho_o', icon: '🏠', label: 'Đổi chỗ ở' },
      { loai: 'hoan_ung', icon: '💰', label: 'Hoàn ứng' },
    ];
    let hdlCount = 0;
    for (let i = 0; i < 60; i += 1) {
      const w = pick(workerRows);
      const t = pick(hdlTypes);
      const daysOld = rand(0, 30);
      const createdAt = daysAgo(daysOld);
      let ghiChu, duLieu;
      if (t.loai === 'bao_nghi_phep') {
        const ngay = toYmd(daysAgo(daysOld - rand(0, 3)));
        ghiChu = `Báo nghỉ phép ngày ${ngay}`;
        duLieu = { ngay, ca_lam: 'nghi_phep' };
      } else if (t.loai === 'bao_nghi_viec') {
        const ngay = toYmd(daysAgo(daysOld));
        ghiChu = `Nghỉ việc từ ${ngay}`;
        duLieu = { ngay, ca_lam: 'nghi_viec' };
      } else if (t.loai === 'chuyen_cong_ty') {
        const old = pick(companyIds);
        const ne = pick(companyIds.filter((x) => x !== old)) || pick(companyIds);
        ghiChu = `Chuyển công ty (#${old} → #${ne})`;
        duLieu = { tu_cong_ty_id: old, sang_cong_ty_id: ne };
      } else if (t.loai === 'chuyen_cho_o') {
        const tu = pick(['ktx', 'phong_tro', 'tu_tuc', 'chua_co_phong']);
        const sang = pick(['ktx', 'phong_tro', 'tu_tuc', 'chua_co_phong'].filter((x) => x !== tu));
        ghiChu = `Đổi tình trạng nơi ở: ${tu} → ${sang}`;
        duLieu = { tu, sang };
      } else {
        const soTien = rand(200, 3000) * 1000;
        ghiChu = `Hoàn ứng ${soTien.toLocaleString('vi-VN')}đ`;
        duLieu = { so_tien: soTien };
      }
      await queryWithRetry(
        `INSERT INTO hoat_dong_log (loai, cong_nhan_id, nguoi_tuyen_id, du_lieu, ghi_chu, created_by, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
        [
          t.loai,
          w.id,
          w.nguoi_tuyen_id,
          JSON.stringify(duLieu),
          ghiChu,
          pick([adminId, ...managerIds]),
          createdAt.toISOString(),
        ],
      );
      hdlCount += 1;
    }
    console.log(`[hoat_dong_log] inserted ${hdlCount}`);

    console.log('\nSeed done.');
    console.log('Accounts:');
    console.log(`- admin / ${PASSWORDS.admin}`);
    console.log(`- ke_toan / ${PASSWORDS.ke_toan}`);
    console.log(`- ql_01..ql_${pad2(SEED_SIZE.managers)} / ${PASSWORDS.quan_ly}`);
    console.log(`- vender_01..vender_${pad2(SEED_SIZE.venders)} / ${PASSWORDS.vender}`);
    console.log(`- ctv_01..ctv_${pad2(SEED_SIZE.ctv)} / ${PASSWORDS.cong_tac_vien}`);
    console.log('All fields populated (media_urls, map_url, ma_van_tay, anh CCCD/chan_dung/xe, ngay_nghi_viec, trang_thai_noi_o).');
  } catch (err) {
    throw err;
  } finally {
    await db.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
