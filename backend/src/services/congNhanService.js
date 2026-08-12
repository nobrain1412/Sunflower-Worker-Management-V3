const congNhanModel = require('../models/congNhanModel');
const congTyModel = require('../models/congTyModel');
const userModel = require('../models/userModel');
const hoatDongLog = require('../models/hoatDongLogModel');
const { sanitizeForRole, sanitizeListForRole } = require('../utils/sanitizeCongNhan');

// Trạng thái "đã đi làm" bắt buộc phải gán công ty (đợi việc / chờ duyệt thì không).
const TRANG_THAI_CAN_CONG_TY = ['dang_lam', 'moi_vao'];

// Các trường được phép ghi đè / bổ sung khi trùng CCCD (từ các cửa sổ thêm mới).
// Cố tình KHÔNG gồm cccd (khỏi tự đụng dedup) và nguoi_tuyen_id (không đổi người
// tuyển qua thao tác ghi đè — tránh vender vô tình cướp CN của người khác).
const GHI_DE_FIELDS = [
  'ho_ten', 'ngay_sinh', 'gioi_tinh', 'que_quan', 'dia_chi_hien_tai',
  'so_dien_thoai', 'ngay_cap_cccd', 'cong_ty_id', 'ngay_vao_lam',
  'ma_van_tay', 'bo_phan', 'ghi_chu',
  'anh_cccd_truoc', 'anh_cccd_sau', 'anh_vneid', 'anh_chan_dung',
];

// Bổ sung = chỉ điền vào ô đang trống của hồ sơ cũ (không đè lên dữ liệu có sẵn).
const BO_SUNG_FIELDS = GHI_DE_FIELDS;

// Date (DB trả Date object) → 'YYYY-MM-DD' để so khớp / trả cho FE. Chuỗi giữ nguyên.
function toISODate(v) {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : String(v);
}

function isEmptyVal(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function assertCongTyKhiCanLamViec(trangThai, congTyId) {
  if (TRANG_THAI_CAN_CONG_TY.includes(trangThai) && !congTyId) {
    const err = new Error('Công nhân "đang làm" / "mới vào" bắt buộc phải gán công ty');
    err.statusCode = 400;
    err.code = 'CONG_TY_REQUIRED';
    throw err;
  }
}

async function danhSach(query, scope, vaiTro, viewerId) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

  // Tự động chuyển trạng thái moi_vao → dang_lam sau 3 ngày đi làm
  await congNhanModel.autoUpdateTrangThai();

  const { rows, total } = await congNhanModel.findAll({
    page, limit,
    sort:       query.sort,
    order:      query.order,
    trang_thai: query.trang_thai,
    trang_thai_noi_o: query.trang_thai_noi_o,
    search:     query.search,
    // '__empty__' = lọc giá trị trống → giữ nguyên sentinel, không parseInt
    vender_id:  query.vender_id === '__empty__' ? '__empty__'
                : (query.vender_id ? parseInt(query.vender_id, 10) : undefined),
    cong_ty_id: query.cong_ty_id === '__empty__' ? '__empty__'
                : (query.cong_ty_id ? parseInt(query.cong_ty_id, 10) : undefined),
    tinh:       query.tinh || undefined,
    ngay:       query.ngay || undefined,
    bo_phan:    query.bo_phan || undefined,
    muon_xe:    query.muon_xe || undefined,
    loai_xe:    query.loai_xe || undefined,
    scope,
  });

  return {
    data: sanitizeListForRole(rows, vaiTro, viewerId),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

// Danh sách bộ phận (distinct) trong phạm vi quyền của người dùng — cho dropdown lọc.
// congTyId (tuỳ chọn): giới hạn bộ phận theo đúng công ty đang chọn.
async function danhSachBoPhan(scope, congTyId = null) {
  return congNhanModel.distinctBoPhan(scope, congTyId);
}

async function chiTiet(id, scope, vaiTro, viewerId) {
  const congNhan = await congNhanModel.findById(id);
  if (!congNhan) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Kiểm tra quyền xem
  // - vender/CTV: chỉ xem CN mình tuyển
  // - quản lý:    chỉ xem CN thuộc công ty mình quản lý
  if (scope?.type === 'vender' && congNhan.nguoi_tuyen_id !== scope.userId) {
    const err = new Error('Bạn không có quyền xem công nhân này');
    err.statusCode = 403; err.code = 'FORBIDDEN';
    throw err;
  }
  if (scope?.type === 'cong_ty') {
    // Quản lý xem được CN thuộc công ty mình quản lý HOẶC do chính mình tuyển
    const theoCongTy = (scope.ids ?? []).includes(congNhan.cong_ty_id);
    const theoNguoiTuyen = scope.userId && congNhan.nguoi_tuyen_id === scope.userId;
    if (!theoCongTy && !theoNguoiTuyen) {
      const err = new Error('Bạn không có quyền xem công nhân này');
      err.statusCode = 403; err.code = 'FORBIDDEN';
      throw err;
    }
  }
  return sanitizeForRole(congNhan, vaiTro, viewerId);
}

async function taoMoi(data, actorUserId = null) {
  // Trùng CCCD → xử lý theo hành động người dùng chọn (kích hoạt lại / ghi đè /
  // bổ sung / thêm mới) hoặc chặn kèm thông tin đối chiếu nếu chưa chọn.
  if (data.cccd) {
    const existing = await congNhanModel.findByCccd(data.cccd);
    if (existing) {
      return xuLyTrungCccd(existing, data, actorUserId);
    }
  }

  // Không trùng → tạo mới bình thường.
  // Validate: trạng thái đang làm / mới vào bắt buộc có công ty
  assertCongTyKhiCanLamViec(data.trang_thai ?? 'moi_vao', data.cong_ty_id);

  const created = await congNhanModel.create(data);

  // Có công ty + đã đi làm (không phải "đợi việc") → tạo phan_cong ngay để
  // công nhân xuất hiện trong bảng công. Bảng chấm công bám theo phan_cong,
  // KHÔNG bám cong_nhan.cong_ty_id. CN "đợi việc" chưa đi làm nên chưa tạo.
  if (created?.cong_ty_id && created.trang_thai !== 'doi_viec') {
    try {
      await taoPhanCong(created.id, created.cong_ty_id, data.ngay_vao_lam);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Tạo phan_cong khi tạo CN thất bại:', e.message);
    }
  }

  return created;
}

// Điều phối khi CCCD trùng với 1 hồ sơ đang có. Tuỳ hành động người dùng chọn:
//   - kich_hoat_lai (CN đã nghỉ)      → tái dùng hồ sơ cũ, mở lại lịch sử làm
//   - hanh_dong_trung = 'ghi_de'      → ghi đè các trường được chọn lên hồ sơ cũ
//   - hanh_dong_trung = 'bo_sung'     → chỉ điền vào ô đang trống của hồ sơ cũ
//   - hanh_dong_trung = 'them_moi'    → tạo hồ sơ MỚI riêng biệt, trạng thái chờ duyệt
//   - chưa chọn gì                    → ném lỗi 409 kèm dữ liệu để FE hiện đối chiếu
async function xuLyTrungCccd(existing, data, actorUserId) {
  const daNghiViec = existing.trang_thai === 'nghi_viec';

  if (daNghiViec && data.kich_hoat_lai) {
    return kichHoatLai(existing, data, actorUserId);
  }
  if (data.hanh_dong_trung === 'them_moi') {
    return themMoiChoDuyet(data, actorUserId);
  }
  if (data.hanh_dong_trung === 'bo_sung') {
    return boSungHoSo(existing.id, data, actorUserId);
  }
  if (data.hanh_dong_trung === 'ghi_de') {
    return ghiDeHoSo(existing.id, data, actorUserId);
  }

  throw await duplicateError(existing, daNghiViec);
}

// Dựng lỗi 409 DUPLICATE_CCCD kèm giá trị hiện tại của hồ sơ cũ (hien_tai) để FE
// hiển thị bảng đối chiếu cũ ↔ mới và cho người dùng chọn trường muốn ghi đè.
async function duplicateError(existingLite, daNghiViec) {
  const full = (await congNhanModel.findById(existingLite.id)) || {};
  const hienTai = {
    ho_ten: full.ho_ten ?? null,
    cccd: full.cccd ?? null,
    ngay_sinh: toISODate(full.ngay_sinh),
    gioi_tinh: full.gioi_tinh ?? null,
    que_quan: full.que_quan ?? null,
    dia_chi_hien_tai: full.dia_chi_hien_tai ?? null,
    so_dien_thoai: full.so_dien_thoai ?? null,
    ngay_cap_cccd: toISODate(full.ngay_cap_cccd),
    ngay_vao_lam: toISODate(full.ngay_vao_lam),
    cong_ty_id: full.cong_ty_id ?? null,
    ten_cong_ty: full.ten_cong_ty ?? null,
    ma_van_tay: full.ma_van_tay ?? null,
    bo_phan: full.bo_phan ?? null,
    ghi_chu: full.ghi_chu ?? null,
    anh_cccd_truoc: full.anh_cccd_truoc ?? null,
    anh_cccd_sau: full.anh_cccd_sau ?? null,
    anh_vneid: full.anh_vneid ?? null,
    anh_chan_dung: full.anh_chan_dung ?? null,
  };
  const err = new Error(
    daNghiViec
      ? `Công nhân "${existingLite.ho_ten}" đã có trong hệ thống và đã nghỉ việc${existingLite.ten_cong_ty ? ` tại ${existingLite.ten_cong_ty}` : ''}. Bạn có thể thêm lại, ghi đè, bổ sung thông tin hoặc thêm mới riêng.`
      : `Công nhân "${existingLite.ho_ten}" đã tồn tại trong hệ thống${existingLite.ten_cong_ty ? `, hiện đang làm tại ${existingLite.ten_cong_ty}` : ' (chưa gán công ty)'}. Chọn ghi đè, bổ sung thông tin hoặc thêm mới riêng.`,
  );
  err.statusCode = 409;
  err.code = 'DUPLICATE_CCCD';
  err.details = [{
    cong_nhan_id: existingLite.id,
    ho_ten: existingLite.ho_ten,
    trang_thai: existingLite.trang_thai,
    cong_ty_id: existingLite.cong_ty_id,
    ten_cong_ty: existingLite.ten_cong_ty ?? null,
    da_nghi_viec: daNghiViec,
    co_the_kich_hoat_lai: daNghiViec,
    hien_tai: hienTai,
  }];
  return err;
}

// GHI ĐÈ: cập nhật các trường người dùng chọn (ghi_de_truong) lên hồ sơ cũ.
// Dùng lại capNhat để hưởng đồng bộ phan_cong (khi đổi công ty) + audit log.
async function ghiDeHoSo(id, data, actorUserId) {
  const chon = Array.isArray(data.ghi_de_truong) ? data.ghi_de_truong : [];
  const patch = {};
  for (const field of chon) {
    if (GHI_DE_FIELDS.includes(field) && field in data) patch[field] = data[field];
  }
  if (Object.keys(patch).length === 0) {
    const err = new Error('Chưa chọn trường nào để ghi đè');
    err.statusCode = 400; err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return capNhat(id, patch, actorUserId, null);
}

// BỔ SUNG: chỉ điền vào các ô đang trống của hồ sơ cũ (không đè lên dữ liệu có sẵn).
async function boSungHoSo(id, data, actorUserId) {
  const existing = await congNhanModel.findById(id);
  if (!existing) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }
  const patch = {};
  for (const field of BO_SUNG_FIELDS) {
    if (field in data && !isEmptyVal(data[field]) && isEmptyVal(existing[field])) {
      patch[field] = data[field];
    }
  }
  if (Object.keys(patch).length === 0) return existing; // không có gì để bổ sung
  return capNhat(id, patch, actorUserId, null);
}

// THÊM MỚI: tạo 1 hồ sơ riêng biệt dù trùng CCCD → trạng thái "chờ duyệt".
// Không tạo phan_cong (đợi admin duyệt vào làm).
async function themMoiChoDuyet(data, actorUserId) {
  const created = await congNhanModel.create({ ...data, trang_thai: 'cho_duyet' });
  try {
    await hoatDongLog.create({
      loai: 'them_moi_trung_cccd',
      muc_do: 'quan_trong',
      cong_nhan_id: created.id,
      nguoi_tuyen_id: created.nguoi_tuyen_id,
      du_lieu: { cccd: created.cccd },
      ghi_chu: `Thêm mới CN trùng CCCD (chờ duyệt): ${created.ho_ten}`,
      created_by: actorUserId,
    });
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.warn('hoat_dong_log write failed:', logErr.message);
  }
  return created;
}

// Kích hoạt lại 1 CN đã nghỉ việc: tái sử dụng hồ sơ cũ (giữ nguyên CCCD + thông
// tin cá nhân) thay vì tạo bản ghi trùng CCCD. Chỉ cập nhật trạng thái + công ty
// + ngày vào làm mới, xoá dấu nghỉ việc và mở một chặng phan_cong mới (lịch sử vào).
async function kichHoatLai(existing, data, actorUserId = null) {
  const today = new Date().toISOString().slice(0, 10);
  // Honor trạng thái người dùng chọn; 'nghi_viec' vô nghĩa khi kích hoạt lại → 'moi_vao'
  const trangThaiMoi = data.trang_thai && data.trang_thai !== 'nghi_viec'
    ? data.trang_thai
    : 'moi_vao';
  assertCongTyKhiCanLamViec(trangThaiMoi, data.cong_ty_id);
  const ngayVao = data.ngay_vao_lam || today;

  const updated = await congNhanModel.update(existing.id, {
    trang_thai:     trangThaiMoi,
    cong_ty_id:     data.cong_ty_id ?? null,
    ngay_vao_lam:   ngayVao,
    ngay_nghi_viec: null, // xoá dấu nghỉ việc cũ
  });

  // Mở chặng làm việc mới (đóng chặng cũ nếu còn hở) — chỉ khi thực sự đi làm
  if (data.cong_ty_id && trangThaiMoi !== 'doi_viec') {
    try {
      await syncPhanCong({
        congNhanId: existing.id,
        newCongTyId: data.cong_ty_id,
        endDate: existing.ngay_nghi_viec || today,
        startDate: ngayVao,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('syncPhanCong khi kích hoạt lại CN thất bại:', e.message);
    }
  }

  // Audit log — fire-and-forget
  try {
    await hoatDongLog.create({
      loai: 'kich_hoat_lai',
      muc_do: 'quan_trong',
      cong_nhan_id: existing.id,
      nguoi_tuyen_id: updated.nguoi_tuyen_id,
      du_lieu: {
        tu_trang_thai: existing.trang_thai,
        sang_trang_thai: trangThaiMoi,
        cong_ty_id: data.cong_ty_id ?? null,
      },
      ghi_chu: `Kích hoạt lại CN đã nghỉ việc: ${updated.ho_ten}`,
      created_by: actorUserId,
    });
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.warn('hoat_dong_log write failed:', logErr.message);
  }

  return updated;
}

// Tạo 1 dòng phan_cong (công nhân ↔ công ty) bắt đầu từ ngayBatDau (hoặc hôm nay).
// Dùng khi tạo CN có công ty hoặc khi duyệt CN "đợi việc" vào làm.
async function taoPhanCong(congNhanId, congTyId, ngayBatDau) {
  const db = require('../utils/db');
  const start = ngayBatDau || new Date().toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau)
     VALUES ($1, $2, $3)`,
    [congNhanId, congTyId, start],
  );
}

// Đồng bộ bảng phan_cong khi CN đổi công ty hoặc nghỉ việc.
// - Đóng phan_cong đang active (ngay_ket_thuc IS NULL) → set ngay_ket_thuc = endDate
// - Nếu newCongTyId không null → tạo phan_cong mới với ngay_bat_dau = startDate
async function syncPhanCong({ congNhanId, newCongTyId, endDate, startDate }) {
  const db = require('../utils/db');
  await db.query(
    `UPDATE phan_cong SET ngay_ket_thuc = $1
      WHERE cong_nhan_id = $2 AND ngay_ket_thuc IS NULL`,
    [endDate, congNhanId],
  );
  if (newCongTyId) {
    await db.query(
      `INSERT INTO phan_cong (cong_nhan_id, cong_ty_id, ngay_bat_dau)
       VALUES ($1, $2, $3)`,
      [congNhanId, newCongTyId, startDate],
    );
  }
}

// Mở lại phan_cong khi CN đi làm lại tại đúng công ty cũ (cong_ty_id không đổi).
// Chỉ tạo dòng mới nếu hiện không còn phan_cong nào đang mở.
async function moLaiPhanCongNeuCan(congNhanId, congTyId, ngayBatDau) {
  const db = require('../utils/db');
  const { rows } = await db.query(
    `SELECT 1 FROM phan_cong WHERE cong_nhan_id = $1 AND ngay_ket_thuc IS NULL LIMIT 1`,
    [congNhanId],
  );
  if (rows.length === 0) {
    await taoPhanCong(congNhanId, congTyId, ngayBatDau);
  }
}

async function capNhat(id, data, actorUserId = null, scope = null) {
  // Nếu có cập nhật CCCD, kiểm tra trùng
  if (data.cccd) {
    const existing = await congNhanModel.findByCccd(data.cccd, id);
    if (existing) {
      const err = new Error('CCCD đã tồn tại trong hệ thống');
      err.statusCode = 409;
      err.code = 'DUPLICATE_CCCD';
      throw err;
    }
  }

  // Snapshot trước khi update để so sánh, ghi audit log
  const before = await congNhanModel.findById(id);

  // Kiểm tra quyền sửa theo scope
  if (before && scope) {
    if (scope.type === 'vender' && before.nguoi_tuyen_id !== scope.userId) {
      const err = new Error('Bạn chỉ được sửa CN do mình tuyển');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }
    if (scope.type === 'cong_ty') {
      // Quản lý sửa được CN thuộc công ty mình quản lý HOẶC do chính mình tuyển
      const theoCongTy = (scope.ids ?? []).includes(before.cong_ty_id);
      const theoNguoiTuyen = scope.userId && before.nguoi_tuyen_id === scope.userId;
      if (!theoCongTy && !theoNguoiTuyen) {
        const err = new Error('Bạn chỉ được sửa CN thuộc công ty mình quản lý');
        err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
      }
    }
  }

  // Đổi người tuyển (chỉ admin tới được đây — controller đã lọc theo vai trò).
  // Bắt lỗi ở đây thay vì để FK ném 23503 thành 500 khó hiểu.
  let nguoiTuyenMoi = null;
  if ('nguoi_tuyen_id' in data) {
    if (data.nguoi_tuyen_id == null) {
      const err = new Error('Người tuyển không được để trống');
      err.statusCode = 400; err.code = 'VALIDATION_ERROR'; throw err;
    }
    nguoiTuyenMoi = await userModel.findById(data.nguoi_tuyen_id);
    if (!nguoiTuyenMoi || !nguoiTuyenMoi.active) {
      const err = new Error('Người tuyển không tồn tại hoặc đã bị khoá');
      err.statusCode = 400; err.code = 'VALIDATION_ERROR'; throw err;
    }
  }

  // Validate: nếu đổi trạng thái/công ty mà kết quả là "đang làm" / "mới vào"
  // thì bắt buộc phải có công ty. Chỉ chặn khi update NÀY mới gây ra vi phạm
  // (không chặn các bản ghi cũ vốn đã thiếu công ty khi sửa field khác).
  if (before && ('trang_thai' in data || 'cong_ty_id' in data)) {
    const trangThaiSau = 'trang_thai' in data ? data.trang_thai : before.trang_thai;
    const congTySau    = 'cong_ty_id'  in data ? data.cong_ty_id  : before.cong_ty_id;
    const viPhamSau    = TRANG_THAI_CAN_CONG_TY.includes(trangThaiSau) && !congTySau;
    const viPhamTruoc  = TRANG_THAI_CAN_CONG_TY.includes(before.trang_thai) && !before.cong_ty_id;
    if (viPhamSau && !viPhamTruoc) {
      assertCongTyKhiCanLamViec(trangThaiSau, congTySau);
    }
  }

  // Đổi công ty THỰC SỰ (từ 1 công ty sang công ty KHÁC — không phải gán lần đầu
  // hay nghỉ việc): mã vân tay + bộ phận gắn với máy chấm công / tổ của công ty cũ
  // nên reset để nhập lại theo công ty mới; ngày vào làm đặt lại theo mốc bắt đầu ở
  // công ty mới (hôm nay). Chỉ tự động khi caller KHÔNG chủ động gửi các trường này.
  const doiCongTyThucSu = before
    && 'cong_ty_id' in data
    && data.cong_ty_id != null
    && before.cong_ty_id != null
    && Number(data.cong_ty_id) !== Number(before.cong_ty_id);
  if (doiCongTyThucSu) {
    const today = new Date().toISOString().slice(0, 10);
    if (!('ma_van_tay' in data))   data.ma_van_tay = null;
    if (!('bo_phan' in data))      data.bo_phan = null;
    if (!('ngay_vao_lam' in data)) data.ngay_vao_lam = today;
  }

  const updated = await congNhanModel.update(id, data);
  if (!updated) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Đồng bộ bảng phan_cong (lịch sử làm việc) theo thay đổi công ty / nghỉ việc.
  // Định nghĩa "đã nghỉ" bám theo FE: trang_thai = nghi_viec HOẶC có ngay_nghi_viec.
  if (before) {
    const today = new Date().toISOString().slice(0, 10);
    const congTyDoi = 'cong_ty_id' in data && before.cong_ty_id !== updated.cong_ty_id;
    const nghiTruoc = before.trang_thai === 'nghi_viec' || !!before.ngay_nghi_viec;
    const nghiSau   = updated.trang_thai === 'nghi_viec' || !!updated.ngay_nghi_viec;
    const ngayNghi  = updated.ngay_nghi_viec
      ? new Date(updated.ngay_nghi_viec).toISOString().slice(0, 10)
      : today;
    try {
      if (congTyDoi) {
        // Đổi công ty: đóng phan_cong cũ, mở phan_cong mới (nếu có công ty mới).
        // Nếu vừa đổi vừa nghỉ việc → chỉ đóng theo ngày nghỉ, không mở mới.
        await syncPhanCong({
          congNhanId: id,
          newCongTyId: nghiSau ? null : updated.cong_ty_id,
          endDate: nghiSau ? ngayNghi : today,
          startDate: today,
        });
      } else if (!nghiTruoc && nghiSau) {
        // Vừa nghỉ việc mà KHÔNG đổi công ty (giữ lại công ty gần nhất):
        // chỉ đóng phan_cong đang mở để chốt lịch sử làm (newCongTyId=null → không mở mới).
        await syncPhanCong({ congNhanId: id, newCongTyId: null, endDate: ngayNghi });
      } else if (nghiTruoc && !nghiSau && updated.cong_ty_id) {
        // Đi làm lại tại đúng công ty cũ → mở lại phan_cong nếu chưa có dòng đang mở.
        await moLaiPhanCongNeuCan(id, updated.cong_ty_id, updated.ngay_vao_lam
          ? new Date(updated.ngay_vao_lam).toISOString().slice(0, 10)
          : today);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('phan_cong sync failed:', e.message);
    }
  }

  // Audit log các thay đổi quan trọng — fire-and-forget, không chặn response
  if (before) {
    try {
      if ('cong_ty_id' in data && before.cong_ty_id !== updated.cong_ty_id) {
        // Ghi tên công ty (thay vì chỉ ID) để timeline đọc được ngay.
        const [ctyCu, ctyMoi] = await Promise.all([
          before.cong_ty_id  ? congTyModel.findById(before.cong_ty_id)  : null,
          updated.cong_ty_id ? congTyModel.findById(updated.cong_ty_id) : null,
        ]);
        const tenCu  = ctyCu?.ten_cong_ty  ?? (before.cong_ty_id  ? `#${before.cong_ty_id}`  : '—');
        const tenMoi = ctyMoi?.ten_cong_ty ?? (updated.cong_ty_id ? `#${updated.cong_ty_id}` : '—');
        await hoatDongLog.create({
          loai: 'chuyen_cong_ty',
          muc_do: 'quan_trong',
          cong_nhan_id: id,
          nguoi_tuyen_id: updated.nguoi_tuyen_id,
          du_lieu: {
            tu_cong_ty_id: before.cong_ty_id, sang_cong_ty_id: updated.cong_ty_id,
            tu_ten_cong_ty: ctyCu?.ten_cong_ty ?? null, sang_ten_cong_ty: ctyMoi?.ten_cong_ty ?? null,
          },
          ghi_chu: `Chuyển công ty (${tenCu} → ${tenMoi})`,
          created_by: actorUserId,
        });
      }
      if ('nguoi_tuyen_id' in data && before.nguoi_tuyen_id !== updated.nguoi_tuyen_id) {
        const cu = before.nguoi_tuyen_id ? await userModel.findById(before.nguoi_tuyen_id) : null;
        await hoatDongLog.create({
          loai: 'doi_nguoi_tuyen',
          muc_do: 'quan_trong',
          cong_nhan_id: id,
          // Gắn log cho người tuyển MỚI để feed của họ thấy CN vừa được chuyển sang
          nguoi_tuyen_id: updated.nguoi_tuyen_id,
          du_lieu: { tu_nguoi_tuyen_id: before.nguoi_tuyen_id, sang_nguoi_tuyen_id: updated.nguoi_tuyen_id },
          ghi_chu: `Đổi người tuyển: ${cu?.ho_ten ?? '—'} → ${nguoiTuyenMoi?.ho_ten ?? `#${updated.nguoi_tuyen_id}`}`,
          created_by: actorUserId,
        });
      }
      if ('trang_thai_noi_o' in data && before.trang_thai_noi_o !== updated.trang_thai_noi_o) {
        await hoatDongLog.create({
          loai: 'chuyen_cho_o',
          muc_do: 'thuong',
          cong_nhan_id: id,
          nguoi_tuyen_id: updated.nguoi_tuyen_id,
          du_lieu: { tu: before.trang_thai_noi_o, sang: updated.trang_thai_noi_o },
          ghi_chu: `Đổi tình trạng nơi ở: ${before.trang_thai_noi_o} → ${updated.trang_thai_noi_o}`,
          created_by: actorUserId,
        });
      }
      if ('trang_thai' in data && before.trang_thai !== updated.trang_thai) {
        const loai = updated.trang_thai === 'nghi_viec' ? 'bao_nghi_viec'
                    : updated.trang_thai === 'nghi_phep' ? 'bao_nghi_phep'
                    : 'doi_trang_thai';
        await hoatDongLog.create({
          loai,
          // Nghỉ việc là sự kiện quan trọng cần admin biết; nghỉ phép/đổi trạng thái khác là thường
          muc_do: loai === 'bao_nghi_viec' ? 'quan_trong' : 'thuong',
          cong_nhan_id: id,
          nguoi_tuyen_id: updated.nguoi_tuyen_id,
          du_lieu: { tu: before.trang_thai, sang: updated.trang_thai },
          ghi_chu: `Trạng thái: ${before.trang_thai} → ${updated.trang_thai}`,
          created_by: actorUserId,
        });
      }
    } catch (logErr) {
      // Không làm fail update vì log audit
      // eslint-disable-next-line no-console
      console.warn('hoat_dong_log write failed:', logErr.message);
    }
  }

  return updated;
}

// Quản lý công ty duyệt 1 CN đang chờ → chính thức vào làm.
// - Phải đang ở trạng thái 'doi_viec' (phỏng vấn đạt) HOẶC 'cho_duyet'
//   (import trùng CCCD thêm mới riêng biệt → cần admin duyệt).
// - quan_ly chỉ duyệt được CN thuộc công ty mình quản lý (admin duyệt bất kỳ)
// - Duyệt xong: trang_thai = 'moi_vao', ngay_vao_lam = ngày duyệt (nếu chưa có)
const DUYET_STATES = ['doi_viec', 'cho_duyet'];
async function duyet(id, user) {
  const before = await congNhanModel.findById(id);
  if (!before) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }
  if (!DUYET_STATES.includes(before.trang_thai)) {
    const err = new Error('Công nhân không ở trạng thái chờ duyệt');
    err.statusCode = 400; err.code = 'INVALID_STATE'; throw err;
  }
  // Duyệt = chuyển sang "mới vào" → bắt buộc đã gán công ty
  if (!before.cong_ty_id) {
    const err = new Error('Cần gán công ty cho công nhân trước khi duyệt vào làm');
    err.statusCode = 400; err.code = 'CONG_TY_REQUIRED'; throw err;
  }
  if (user?.vai_tro === 'quan_ly') {
    const congTyIds = user.cong_ty_ids ?? [];
    if (!congTyIds.includes(before.cong_ty_id)) {
      const err = new Error('Bạn chỉ được duyệt công nhân thuộc công ty mình quản lý');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const ngayVao = before.ngay_vao_lam
    ? new Date(before.ngay_vao_lam).toISOString().slice(0, 10)
    : today;
  const updated = await congNhanModel.update(id, {
    trang_thai: 'moi_vao',
    ngay_vao_lam: ngayVao,
  });

  // Duyệt vào làm → tạo phan_cong để có bảng công (nếu chưa có cho công ty này).
  if (updated?.cong_ty_id) {
    try {
      const db = require('../utils/db');
      const { rows } = await db.query(
        `SELECT 1 FROM phan_cong WHERE cong_nhan_id = $1 AND cong_ty_id = $2 LIMIT 1`,
        [id, updated.cong_ty_id],
      );
      if (rows.length === 0) await taoPhanCong(id, updated.cong_ty_id, ngayVao);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Tạo phan_cong khi duyệt CN thất bại:', e.message);
    }
  }

  // Audit log — fire-and-forget, không chặn response
  try {
    await hoatDongLog.create({
      loai: 'duyet_cong_nhan',
      muc_do: 'quan_trong',
      cong_nhan_id: id,
      nguoi_tuyen_id: updated.nguoi_tuyen_id,
      du_lieu: { cong_ty_id: before.cong_ty_id },
      ghi_chu: `Duyệt vào làm: ${updated.ho_ten} (${before.trang_thai} → mới vào)`,
      created_by: user?.id ?? null,
    });
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.warn('hoat_dong_log write failed:', logErr.message);
  }

  return updated;
}

// Từ chối duyệt 1 CN đang chờ (doi_viec / cho_duyet) → soft delete + ghi audit log.
// Dùng khi phỏng vấn không đạt hoặc bản ghi trùng CCCD thêm nhầm.
// - Phải đang ở trạng thái chờ duyệt (DUYET_STATES), tránh xoá nhầm CN đang làm.
// - admin: từ chối bất kỳ; quan_ly: chỉ CN thuộc công ty mình quản lý HOẶC do mình tuyển.
async function tuChoi(id, user, lyDo = null) {
  const before = await congNhanModel.findById(id);
  if (!before) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }
  if (!DUYET_STATES.includes(before.trang_thai)) {
    const err = new Error('Công nhân không ở trạng thái chờ duyệt');
    err.statusCode = 400; err.code = 'INVALID_STATE'; throw err;
  }
  if (user?.vai_tro === 'quan_ly') {
    const congTyIds = user.cong_ty_ids ?? [];
    const laNguoiTuyen = before.nguoi_tuyen_id === user.id;
    // CN đợi việc có thể chưa gán công ty → cho phép nếu chính mình tuyển.
    if (!congTyIds.includes(before.cong_ty_id) && !laNguoiTuyen) {
      const err = new Error('Bạn chỉ được từ chối công nhân thuộc công ty mình quản lý');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }
  }

  const deleted = await congNhanModel.softDelete(id);
  if (!deleted) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }

  // Audit log — fire-and-forget, không chặn response
  try {
    await hoatDongLog.create({
      loai: 'tu_choi_cong_nhan',
      muc_do: 'quan_trong',
      cong_nhan_id: id,
      nguoi_tuyen_id: before.nguoi_tuyen_id,
      du_lieu: { tu_trang_thai: before.trang_thai, cong_ty_id: before.cong_ty_id, ly_do: lyDo ?? null },
      ghi_chu: `Từ chối duyệt: ${before.ho_ten}${lyDo ? ` — ${lyDo}` : ''}`,
      created_by: user?.id ?? null,
    });
  } catch (logErr) {
    // eslint-disable-next-line no-console
    console.warn('hoat_dong_log write failed:', logErr.message);
  }

  return before;
}

async function xoa(id, user) {
  // Kiểm tra quyền xoá theo role:
  // - admin: xoá bất kỳ
  // - vender / cong_tac_vien: chỉ CN mình tuyển VÀ đang ở 'doi_viec' (phỏng vấn trượt)
  // - quan_ly: không được xoá
  if (user && user.vai_tro !== 'admin') {
    const before = await congNhanModel.findById(id);
    if (!before) {
      const err = new Error('Không tìm thấy công nhân');
      err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
    }
    const laNguoiTuyen = before.nguoi_tuyen_id === user.id;
    const choPhepXoa = (user.vai_tro === 'vender' || user.vai_tro === 'cong_tac_vien')
      && laNguoiTuyen
      && before.trang_thai === 'doi_viec';
    if (!choPhepXoa) {
      const err = new Error('Chỉ được xoá công nhân bạn tuyển khi đang chờ phỏng vấn');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }
  }

  // Soft delete: giữ toàn bộ dữ liệu liên kết (chấm công, tài chính, chỗ ở...)
  // nên không còn vướng FK RESTRICT như xoá thật.
  const deleted = await congNhanModel.softDelete(id);
  if (!deleted) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
}

// Gán công ty hàng loạt cho nhiều CN cùng lúc (thường là CN "đợi việc" chưa có công ty).
// Tái dùng capNhat cho từng CN để hưởng đủ: kiểm tra scope, đồng bộ phan_cong, audit log.
// - trangThai: trạng thái sau khi gán. Mặc định 'moi_vao' (vào làm luôn); có thể 'doi_viec'.
// - quan_ly chỉ được gán vào công ty mình quản lý.
// Trả { assigned, skipped: [{ id, reason }] }.
async function ganCongTyHangLoat({ ids, congTyId, trangThai, user, scope }) {
  const db = require('../utils/db');

  // Công ty đích phải tồn tại
  const ct = await db.query('SELECT id FROM cong_ty WHERE id = $1', [congTyId]);
  if (!ct.rows.length) {
    const err = new Error('Không tìm thấy công ty');
    err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }
  // Quản lý chỉ được gán vào công ty mình quản lý
  if (user?.vai_tro === 'quan_ly') {
    const managed = user.cong_ty_ids ?? [];
    if (!managed.includes(congTyId)) {
      const err = new Error('Bạn chỉ được gán vào công ty mình quản lý');
      err.statusCode = 403; err.code = 'FORBIDDEN'; throw err;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  let assigned = 0;
  const skipped = [];

  for (const id of ids) {
    try {
      const before = await congNhanModel.findById(id);
      if (!before) { skipped.push({ id, reason: 'Không tồn tại' }); continue; }

      // Trạng thái sau: ưu tiên giá trị người dùng chọn; nếu không, đưa CN
      // "đợi việc"/"chờ duyệt" vào làm ('moi_vao'), còn lại giữ nguyên.
      const trangThaiSau = trangThai
        || (['doi_viec', 'cho_duyet'].includes(before.trang_thai) ? 'moi_vao' : before.trang_thai);

      const payload = { cong_ty_id: congTyId, trang_thai: trangThaiSau };
      // Vào làm mà chưa có ngày vào → set hôm nay (đợi việc thì không cần)
      if (trangThaiSau !== 'doi_viec' && !before.ngay_vao_lam) payload.ngay_vao_lam = today;

      await capNhat(id, payload, user?.id ?? null, scope);
      assigned++;
    } catch (e) {
      skipped.push({ id, reason: e.message });
    }
  }

  return { assigned, skipped };
}

module.exports = { danhSach, danhSachBoPhan, chiTiet, taoMoi, capNhat, duyet, tuChoi, xoa, ganCongTyHangLoat };
