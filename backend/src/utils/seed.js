/**
 * Seed dữ liệu test đầy đủ cho tất cả role.
 * Dùng: node src/utils/seed.js
 *
 * Sẽ XÓA toàn bộ data cũ và tạo lại — CHỈ dùng môi trường dev.
 *
 * Tài khoản sau khi seed:
 *   admin        / Admin@123    → Quản trị viên
 *   tuan_ql      / QL@123       → Quản lý (Cty ABC + Cty XYZ)   ← 1 QL nhiều cty
 *   minh_ql      / QL@123       → Quản lý (Cty XYZ + Cty DEF)   ← 1 cty nhiều QL (XYZ)
 *   hoa_vender   / VD@123       → Vender
 *   duc_vender   / VD@123       → Vender
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('./db');

const MAT_KHAU_QL  = 'QL@123';
const MAT_KHAU_VD  = 'VD@123';
const MAT_KHAU_ADM = 'Admin@123';

async function seed() {
  console.log('⚠️  Seed sẽ XÓA toàn bộ data hiện tại...\n');

  // ── 0. Xóa data cũ theo thứ tự FK ────────────────────────────────────────
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM quan_ly_cong_ty');
  await db.query('DELETE FROM cong_nhan');
  await db.query('DELETE FROM cong_ty');
  await db.query('DELETE FROM users');
  // Reset sequences
  for (const t of ['users', 'cong_ty', 'cong_nhan', 'quan_ly_cong_ty']) {
    await db.query(`ALTER SEQUENCE ${t}_id_seq RESTART WITH 1`);
  }
  console.log('✓ Đã xóa data cũ\n');

  // ── 1. Hash passwords song song ──────────────────────────────────────────
  const [hashAdm, hashQL, hashVD] = await Promise.all([
    bcrypt.hash(MAT_KHAU_ADM, 10),
    bcrypt.hash(MAT_KHAU_QL, 10),
    bcrypt.hash(MAT_KHAU_VD, 10),
  ]);

  // ── 2. Tạo users ─────────────────────────────────────────────────────────
  const usersData = [
    { ten_dang_nhap: 'admin',      ho_ten: 'Nguyễn Quản Trị',     vai_tro: 'admin',   hash: hashAdm },
    { ten_dang_nhap: 'tuan_ql',    ho_ten: 'Nguyễn Thành Tuấn',   vai_tro: 'quan_ly', hash: hashQL  },
    { ten_dang_nhap: 'minh_ql',    ho_ten: 'Trần Văn Minh',       vai_tro: 'quan_ly', hash: hashQL  },
    { ten_dang_nhap: 'hoa_vender', ho_ten: 'Lê Thị Hoa',          vai_tro: 'vender',  hash: hashVD  },
    { ten_dang_nhap: 'duc_vender', ho_ten: 'Phạm Văn Đức',        vai_tro: 'vender',  hash: hashVD  },
  ];

  const userIds = {};
  for (const u of usersData) {
    const r = await db.query(
      `INSERT INTO users (ten_dang_nhap, mat_khau_hash, ho_ten, vai_tro)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [u.ten_dang_nhap, u.hash, u.ho_ten, u.vai_tro],
    );
    userIds[u.ten_dang_nhap] = r.rows[0].id;
  }
  console.log('✓ Đã tạo 5 users:', Object.entries(userIds).map(([k, v]) => `${k}(#${v})`).join(', '));

  // ── 3. Tạo công ty ────────────────────────────────────────────────────────
  const congTyData = [
    {
      ten: 'Công ty TNHH Sản xuất ABC',
      dia_chi: '123 Nguyễn Văn Linh, Q.7, TP.HCM',
      sdt: '0281234567', email: 'abc@congty.vn',
      luong_co_ban: 5500000, luong_theo_gio: 35000, he_so_ot: 1.5, ngay_lam_chuan: 26,
    },
    {
      ten: 'Công ty Cổ phần Dịch vụ XYZ',
      dia_chi: '456 Lê Văn Việt, Q.9, TP.HCM',
      sdt: '0287654321', email: 'xyz@congty.vn',
      luong_co_ban: 6000000, luong_theo_gio: 40000, he_so_ot: 1.5, ngay_lam_chuan: 26,
    },
    {
      ten: 'Công ty TNHH Thương mại DEF',
      dia_chi: '789 Đinh Tiên Hoàng, Bình Thạnh, TP.HCM',
      sdt: '0289876543', email: 'def@congty.vn',
      luong_co_ban: 5200000, luong_theo_gio: 33000, he_so_ot: 1.5, ngay_lam_chuan: 26,
    },
    {
      ten: 'Công ty Cổ phần Xây dựng GHI',
      dia_chi: '321 Cộng Hòa, Tân Bình, TP.HCM',
      sdt: '0283456789', email: 'ghi@congty.vn',
      luong_co_ban: 5800000, luong_theo_gio: 38000, he_so_ot: 2.0, ngay_lam_chuan: 26,
    },
  ];

  const congTyIds = [];
  for (const ct of congTyData) {
    const r = await db.query(
      `INSERT INTO cong_ty (ten_cong_ty, dia_chi, so_dien_thoai, email, luong_co_ban, luong_theo_gio, he_so_ot, ngay_lam_chuan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [ct.ten, ct.dia_chi, ct.sdt, ct.email, ct.luong_co_ban, ct.luong_theo_gio, ct.he_so_ot, ct.ngay_lam_chuan],
    );
    congTyIds.push(r.rows[0].id);
  }
  const [ctyABC, ctyXYZ, ctyDEF, ctyGHI] = congTyIds;
  console.log(`✓ Đã tạo 4 công ty: ABC(#${ctyABC}) XYZ(#${ctyXYZ}) DEF(#${ctyDEF}) GHI(#${ctyGHI})`);

  // ── 4. Phân công quản lý ──────────────────────────────────────────────────
  // tuan_ql   → ABC + XYZ   (1 quản lý nhiều công ty)
  // minh_ql   → XYZ + DEF   (XYZ có 2 quản lý: tuan + minh)
  const assignments = [
    [userIds.tuan_ql, ctyABC],
    [userIds.tuan_ql, ctyXYZ],
    [userIds.minh_ql, ctyXYZ],
    [userIds.minh_ql, ctyDEF],
  ];
  for (const [uid, cid] of assignments) {
    await db.query(
      `INSERT INTO quan_ly_cong_ty (user_id, cong_ty_id) VALUES ($1, $2)`,
      [uid, cid],
    );
  }
  console.log('✓ Phân công quản lý:');
  console.log(`  tuan_ql (#${userIds.tuan_ql}) → ABC(#${ctyABC}) + XYZ(#${ctyXYZ})  ← 1 QL nhiều cty`);
  console.log(`  minh_ql (#${userIds.minh_ql}) → XYZ(#${ctyXYZ}) + DEF(#${ctyDEF})  ← XYZ có 2 QL`);

  // ── 5. Tạo công nhân ─────────────────────────────────────────────────────
  // today = CURRENT_DATE trong SQL, dùng 'today' làm placeholder
  const today = new Date().toISOString().split('T')[0];
  const d = (offset) => {
    const dt = new Date();
    dt.setDate(dt.getDate() - offset);
    return dt.toISOString().split('T')[0];
  };

  // [ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, sdt, trang_thai, ngay_vao_lam, nguoi_tuyen_id]
  const congNhanData = [
    // ── Tuyển bởi admin (5 người) ──
    ['Nguyễn Văn An',       '034111222333', '1995-03-15', 'Nam', 'Hà Nội',      '0901234001', 'dang_lam',  d(90),  userIds.admin],
    ['Trần Thị Bình',       '034222333444', '1997-07-22', 'Nữ',  'Nghệ An',     '0901234002', 'dang_lam',  d(60),  userIds.admin],
    ['Lê Văn Cường',        '034333444555', '1993-11-08', 'Nam', 'Thanh Hóa',   '0901234003', 'moi_vao',   today,  userIds.admin],
    ['Phạm Thị Dung',       '034444555666', '1999-05-30', 'Nữ',  'Hà Tĩnh',     '0901234004', 'dang_lam',  d(45),  userIds.admin],
    ['Hoàng Văn Em',        '034555666777', '1996-09-14', 'Nam', 'Nam Định',    '0901234005', 'nghi_phep', d(120), userIds.admin],

    // ── Tuyển bởi tuan_ql (6 người) ──
    ['Vũ Thị Phương',       '034666777888', '1998-01-25', 'Nữ',  'Bắc Giang',   '0902234001', 'dang_lam',  d(75),  userIds.tuan_ql],
    ['Đặng Văn Quang',      '034777888999', '1994-06-18', 'Nam', 'Bắc Ninh',    '0902234002', 'dang_lam',  d(50),  userIds.tuan_ql],
    ['Bùi Thị Rin',         '034888999000', '2000-12-03', 'Nữ',  'Hải Dương',   '0902234003', 'moi_vao',   today,  userIds.tuan_ql],
    ['Ngô Văn Sơn',         '035111222333', '1992-04-09', 'Nam', 'Hưng Yên',    '0902234004', 'dang_lam',  d(100), userIds.tuan_ql],
    ['Đinh Thị Thu',        '035222333444', '1997-08-16', 'Nữ',  'Thái Bình',   '0902234005', 'dang_lam',  d(30),  userIds.tuan_ql],
    ['Trịnh Văn Uy',        '035333444555', '1995-02-27', 'Nam', 'Ninh Bình',   '0902234006', 'nghi_viec', d(180), userIds.tuan_ql],

    // ── Tuyển bởi minh_ql (5 người) ──
    ['Lý Thị Vân',          '035444555666', '1999-10-11', 'Nữ',  'Quảng Bình',  '0903234001', 'dang_lam',  d(40),  userIds.minh_ql],
    ['Phan Văn Xuyên',      '035555666777', '1993-07-04', 'Nam', 'Quảng Trị',   '0903234002', 'dang_lam',  d(55),  userIds.minh_ql],
    ['Cao Thị Yến',         '035666777888', '2001-03-19', 'Nữ',  'Thừa Thiên Huế', '0903234003', 'moi_vao', d(3),  userIds.minh_ql],
    ['Mai Văn Zung',        '035777888999', '1996-11-28', 'Nam', 'Đà Nẵng',     '0903234004', 'dang_lam',  d(70),  userIds.minh_ql],
    ['Trương Thị Ánh',      '035888999000', '1998-06-07', 'Nữ',  'Quảng Nam',   '0903234005', 'dang_lam',  d(85),  userIds.minh_ql],

    // ── Tuyển bởi hoa_vender (3 người) ──
    ['Lương Văn Bảo',       '036111222333', '1994-09-22', 'Nam', 'Quảng Ngãi',  '0904234001', 'dang_lam',  d(35),  userIds.hoa_vender],
    ['Đoàn Thị Chiều',      '036222333444', '2000-04-15', 'Nữ',  'Bình Định',   '0904234002', 'moi_vao',   today,  userIds.hoa_vender],
    ['Tô Văn Danh',         '036333444555', '1997-12-30', 'Nam', 'Phú Yên',     '0904234003', 'dang_lam',  d(20),  userIds.hoa_vender],

    // ── Tuyển bởi duc_vender (2 người) ──
    ['Hà Thị Ếm',           '036444555666', '1999-08-05', 'Nữ',  'Khánh Hòa',   '0905234001', 'dang_lam',  d(25),  userIds.duc_vender],
    ['Kiều Văn Phong',      '036555666777', '1995-01-17', 'Nam', 'Ninh Thuận',  '0905234002', 'nghi_phep', d(150), userIds.duc_vender],
  ];

  let cnCount = 0;
  for (const [ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, sdt, trang_thai, ngay_vao_lam, tuyen_id] of congNhanData) {
    await db.query(
      `INSERT INTO cong_nhan
         (ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, so_dien_thoai,
          trang_thai, ngay_vao_lam, nguoi_tuyen_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, sdt, trang_thai, ngay_vao_lam, tuyen_id],
    );
    cnCount++;
  }
  console.log(`\n✓ Đã tạo ${cnCount} công nhân`);

  // ── 6. Tổng kết ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  SEED HOÀN THÀNH — Tài khoản test:');
  console.log('══════════════════════════════════════════════════════');
  console.log('  ROLE          TÊN ĐĂNG NHẬP   MẬT KHẨU');
  console.log('  ─────────────────────────────────────────────────');
  console.log('  Admin         admin            Admin@123');
  console.log('  Quản lý       tuan_ql          QL@123    (ABC + XYZ)');
  console.log('  Quản lý       minh_ql          QL@123    (XYZ + DEF)');
  console.log('  Vender        hoa_vender       VD@123    (tuyển 3 CN)');
  console.log('  Vender        duc_vender       VD@123    (tuyển 2 CN)');
  console.log('══════════════════════════════════════════════════════');
  console.log('\n  Test cases phân quyền:');
  console.log('  • tuan_ql quản lý 2 cty  → dropdown hiện ABC + XYZ');
  console.log('  • minh_ql quản lý 2 cty  → dropdown hiện XYZ + DEF');
  console.log('  • Cty XYZ có 2 QL        → cả tuan + minh đều thấy');
  console.log('  • hoa_vender             → chỉ thấy 3 CN mình tuyển');
  console.log('  • Hôm nay có 3 CN mới vào (An, Rin, Chiều)');
  console.log('══════════════════════════════════════════════════════\n');

  await db.end();
}

seed().catch((err) => {
  console.error('\n✗ Seed thất bại:', err.message);
  console.error(err.stack);
  process.exit(1);
});
