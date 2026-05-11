/**
 * Seed dữ liệu demo liên kết đầy đủ.
 * Yêu cầu demo:
 * - 10 users
 * - 10 công ty
 * - 50 công nhân đủ thông tin
 * - Không seed bảng chấm công
 * - Tài chính random theo khoản thu/chi/tiêu
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
const SEED_SIZE = {
  managers: 4,
  venders: 3,
  ctv: 1,
  companies: 10,
  workers: 50,
  ktx: 3,
  roomsPerKtx: 6,
  bedsPerRoom: 6,
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
  return msg.includes('timeout') || msg.includes('terminating connection') || msg.includes('connection') && msg.includes('reset');
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
      (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro, so_dien_thoai, ngan_hang, so_tai_khoan, ten_chu_tk, tien_cong_moi_nguoi)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [
      ten_dang_nhap,
      hash,
      ho_ten,
      vai_tro,
      extra.so_dien_thoai || null,
      extra.ngan_hang || null,
      extra.so_tai_khoan || null,
      extra.ten_chu_tk || null,
      extra.tien_cong_moi_nguoi || 0,
    ],
  );
  return r.rows[0].id;
}

async function seed() {
  console.log('Seeding demo data...');
  try {
    await queryWithRetry(`SET lock_timeout = '12s'`, [], 'set lock_timeout');
    await queryWithRetry(`SET statement_timeout = '8min'`, [], 'set statement_timeout');
    await queryWithRetry(`SET idle_in_transaction_session_timeout = '5min'`, [], 'set idle timeout');

    logPhase('Reset database data');
    await queryWithRetry(
      `TRUNCATE TABLE
        refresh_tokens, cham_cong, phan_cong, giao_dich_tai_chinh, hoa_don_ktx,
        thue_phong, giuong, phong, ky_tuc_xa, thue_phong_tro, phong_tro,
        ocr_quet, quan_ly_cong_ty, cong_nhan, cong_ty, users
       RESTART IDENTITY CASCADE`,
      [],
      'truncate all tables',
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
    const adminId = await createUser('admin', 'Admin WorkerOS', 'admin', hashAdmin, { so_dien_thoai: '0900000000' });
    const keToanId = await createUser('ke_toan', 'Ke Toan Tong', 'ke_toan', hashKeToan, { so_dien_thoai: '0900000001' });
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
      ctvIds.push(await createUser(`ctv_${pad2(i)}`, `Cong Tac Vien ${fullName(i + 80)}`, 'cong_tac_vien', hashCtv, {
        so_dien_thoai: phone(300 + i),
        tien_cong_moi_nguoi: 120000 + i * 10000,
      }));
      logProgress('ctv', i, SEED_SIZE.ctv, 1);
    }

    logPhase('Create companies');
    const companyRows = [];
    for (let i = 1; i <= SEED_SIZE.companies; i += 1) {
      const r = await queryWithRetry(
        `INSERT INTO cong_ty
          (ten_cong_ty, dia_chi, so_dien_thoai, email, luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan, luong_tc_ngay, luong_hc_dem, luong_tc_dem, luong_chu_nhat, luong_ngay_le, tien_dong_phuc, tien_phat_nghi, don_gia_theo_gio_vender, tro_cap, chuyen_can, ngay_chot_cong, mo_ta_cong_viec)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,26,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         RETURNING id, luong_co_ban, luong_theo_gio`,
        [
          `Cong Ty Demo ${pad2(i)}`,
          `${100 + i} Duong Demo, ${pick(PROVINCES)}`,
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
          250000 + i * 10000,
          180000 + i * 12000,
          20000 + i * 1500,
          250000 + i * 12000,
          300000 + i * 15000,
          25,
          `Mo ta cong viec cong ty ${i}`,
        ],
      );
      companyRows.push(r.rows[0]);
      logProgress('companies', i, SEED_SIZE.companies, 2);
    }
    const companyIds = companyRows.map((r) => r.id);

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
      const r = await queryWithRetry(
        `INSERT INTO cong_nhan
          (ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, dia_chi_hien_tai, so_dien_thoai, ngay_cap_cccd, noi_cap_cccd, trang_thai, ngay_vao_lam, ghi_chu, nguoi_tuyen_id, cong_ty_id, da_tra_dong_phuc, da_viet_don_nghi, ngan_hang, so_tai_khoan, ten_chu_tk, cccd_da_tra, muon_xe, loai_xe, xe_da_tra)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         RETURNING id, ngay_vao_lam, cong_ty_id, nguoi_tuyen_id, trang_thai`,
        [
          `Cong Nhan ${fullName(i)}`,
          cccd(i),
          ngaySinh,
          gioi_tinh,
          pick(PROVINCES),
          `${rand(1, 999)} Khu pho ${rand(1, 20)}, ${pick(PROVINCES)}`,
          phone(500 + i),
          ngayCap,
          'Cuc Canh Sat QLHC',
          status,
          ngayVao,
          `Ghi chu demo cong nhan ${i}`,
          recruiterId,
          companyId,
          chance(0.7),
          chance(0.25),
          pick(BANKS),
          accountNo(500 + i),
          `CONG NHAN ${i}`,
          chance(0.35),
          chance(0.4),
          chance(0.4) ? pick(['xe_dap', 'xe_dien', 'xe_may']) : null,
          chance(0.3),
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

    logPhase('Skip attendance');
    console.log('Skipping cham_cong seeding as requested.');

    logPhase('Create KTX / rooms / beds');
    const roomRows = [];
    const bedRows = [];
    for (let k = 1; k <= SEED_SIZE.ktx; k += 1) {
      const ktx = await queryWithRetry(
        `INSERT INTO ky_tuc_xa (ten, dia_chi, ghi_chu) VALUES ($1,$2,$3) RETURNING id`,
        [`KTX ${pad2(k)}`, `${200 + k} Duong KTX, ${pick(PROVINCES)}`, `KTX demo ${k}`],
      );
      for (let r = 1; r <= SEED_SIZE.roomsPerKtx; r += 1) {
        const room = await queryWithRetry(
          `INSERT INTO phong (ktx_id, ten_phong, tang, suc_chua, tien_phong, ghi_chu)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, tien_phong`,
          [ktx.rows[0].id, `P${k}${pad2(r)}`, 1 + Math.floor((r - 1) / 3), 6, 1500000 + r * 80000, 'Phong demo'],
        );
        roomRows.push(room.rows[0]);
        for (let b = 1; b <= SEED_SIZE.bedsPerRoom; b += 1) {
          const bed = await queryWithRetry(
            `INSERT INTO giuong (phong_id, so_thu_tu, ghi_chu) VALUES ($1,$2,$3) RETURNING id, phong_id`,
            [room.rows[0].id, b, 'Giuong demo'],
          );
          bedRows.push(bed.rows[0]);
        }
      }
      logProgress('ktx', k, SEED_SIZE.ktx, 1);
    }

    logPhase('Assign workers to KTX beds');
    const activeWorkers = workerRows.filter((w) => w.trang_thai !== 'nghi_viec');
    const ktxWorkers = activeWorkers.slice(0, Math.min(activeWorkers.length, bedRows.length));
    for (let i = 0; i < ktxWorkers.length; i += 1) {
      const w = ktxWorkers[i];
      const bed = bedRows[i];
      await queryWithRetry(
        `INSERT INTO thue_phong (cong_nhan_id, giuong_id, ngay_vao, ghi_chu)
         VALUES ($1,$2,$3,$4)`,
        [w.id, bed.id, addDays(w.ngay_vao_lam, rand(0, 10)), 'Thue giuong demo'],
      );
      logProgress('thue_phong', i + 1, ktxWorkers.length, 30);
    }

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
          [room.id, m.thang, m.nam, dienCu, dienCu + rand(35, 70), 3200, nuocCu, nuocCu + rand(8, 20), 17000, room.tien_phong, 'Hoa don demo'],
        );
      }
    }
    console.log(`[hoa_don_ktx] inserted ${roomRows.length * 2}`);

    logPhase('Create external hostels (phong_tro)');
    const phongTroIds = [];
    for (let i = 1; i <= 8; i += 1) {
      const pt = await queryWithRetry(
        `INSERT INTO phong_tro (ten, dia_chi, map_url, chu_tro, sdt_chu_tro, so_phong, tien_phong, ghi_chu, ngan_hang, so_tai_khoan, ten_chu_tk)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          `Nha tro ${pad2(i)}`,
          `${300 + i} Duong Tro, ${pick(PROVINCES)}`,
          `https://maps.google.com/?q=nha+tro+${i}`,
          `Chu tro ${i}`,
          phone(700 + i),
          rand(8, 24),
          2300000 + i * 50000,
          'Nha tro demo',
          pick(BANKS),
          accountNo(800 + i),
          `CHU TRO ${i}`,
        ],
      );
      phongTroIds.push(pt.rows[0].id);
      logProgress('phong_tro', i, 8, 2);
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
      logProgress('thue_phong_tro', i + 1, troWorkers.length, 20);
    }

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

        await queryWithRetry(
          `INSERT INTO giao_dich_tai_chinh
            (cong_nhan_id, danh_muc_id, loai, so_tien, ngay, ghi_chu, created_by, da_hoan_tien)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            w.id,
            danhMucId,
            loai,
            soTien,
            toYmd(daysAgo(rand(2, 90))),
            `${note} (${categoryName})`,
            pick([keToanId, adminId, w.nguoi_tuyen_id || adminId]),
            loai === 'chi' && categoryName === 'Tạm ứng' ? chance(0.4) : false,
          ],
        );
        gdtcCount += 1;
      }

      if (gdtcCount % 200 === 0) {
        console.log(`[giao_dich_tai_chinh] inserted ${gdtcCount}`);
      }
    }
    console.log(`[giao_dich_tai_chinh] inserted total ${gdtcCount}`);

    logPhase('Create OCR logs');
    for (let i = 0; i < 80; i += 1) {
      const creatorPool = [adminId, ...managerIds, ...venderIds];
      const creator = creatorPool[i % creatorPool.length];
      const approved = chance(0.6);
      const worker = workerRows[i % workerRows.length];
      await queryWithRetry(
        `INSERT INTO ocr_quet (loai, duong_dan_anh, ket_qua_json, trang_thai, created_by, cong_nhan_id, ghi_chu)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          i % 3 === 0 ? 'danh_sach' : 'cccd',
          `/uploads/ocr/demo_${i + 1}.jpg`,
          JSON.stringify({ index: i + 1, ho_ten: worker.id }),
          approved ? 'da_duyet' : 'cho_duyet',
          creator,
          approved ? worker.id : null,
          approved ? 'Duyet tu dong seed' : 'Cho duyet demo',
        ],
      );
      logProgress('ocr_quet', i + 1, 80, 20);
    }

    console.log('Seed done.');
    console.log('Accounts:');
    console.log(`- admin / ${PASSWORDS.admin}`);
    console.log(`- ql_01..ql_04 / ${PASSWORDS.quan_ly}`);
    console.log(`- vender_01..vender_03 / ${PASSWORDS.vender}`);
    console.log(`- ke_toan / ${PASSWORDS.ke_toan}`);
    console.log(`- ctv_01 / ${PASSWORDS.cong_tac_vien}`);
    console.log('Data counts: 10 users, 10 cong ty, 50 cong nhan, khong seed cham_cong, tai chinh random thu/chi/tieu.');
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
