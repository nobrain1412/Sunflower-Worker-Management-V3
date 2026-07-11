const congNhanModel = require('../models/congNhanModel');
const userModel = require('../models/userModel');
const hoatDongLog = require('../models/hoatDongLogModel');
const { sanitizeForRole, sanitizeListForRole } = require('../utils/sanitizeCongNhan');

// Trạng thái "đã đi làm" bắt buộc phải gán công ty (đợi việc / chờ duyệt thì không).
const TRANG_THAI_CAN_CONG_TY = ['dang_lam', 'moi_vao'];

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
    scope,
  });

  return {
    data: sanitizeListForRole(rows, vaiTro, viewerId),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
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
  // Validate: trạng thái đang làm / mới vào bắt buộc có công ty
  assertCongTyKhiCanLamViec(data.trang_thai ?? 'moi_vao', data.cong_ty_id);

  if (data.cccd) {
    const existing = await congNhanModel.findByCccd(data.cccd);
    if (existing) {
      const daNghiViec = existing.trang_thai === 'nghi_viec';

      // CN cũ đã nghỉ việc + người thêm xác nhận → kích hoạt lại hồ sơ cũ
      // (KHÔNG tạo bản ghi trùng CCCD, chỉ cập nhật trạng thái + lịch sử vào).
      if (daNghiViec && data.kich_hoat_lai) {
        return kichHoatLai(existing, data, actorUserId);
      }

      // Ngược lại: chặn nhưng kèm thông tin CN đang ở đâu để người thêm biết,
      // vì họ có thể không tìm thấy CN này (không phải mình tuyển / khác công ty).
      const err = new Error(
        daNghiViec
          ? `Công nhân "${existing.ho_ten}" đã có trong hệ thống và đã nghỉ việc${existing.ten_cong_ty ? ` tại ${existing.ten_cong_ty}` : ''}. Bạn có thể thêm lại để cập nhật trạng thái và lịch sử vào làm.`
          : `Công nhân "${existing.ho_ten}" đã tồn tại trong hệ thống${existing.ten_cong_ty ? `, hiện đang làm tại ${existing.ten_cong_ty}` : ' (chưa gán công ty)'}.`,
      );
      err.statusCode = 409;
      err.code = 'DUPLICATE_CCCD';
      err.details = [{
        cong_nhan_id: existing.id,
        ho_ten: existing.ho_ten,
        trang_thai: existing.trang_thai,
        cong_ty_id: existing.cong_ty_id,
        ten_cong_ty: existing.ten_cong_ty ?? null,
        da_nghi_viec: daNghiViec,
        // Chỉ CN đã nghỉ việc mới cho phép kích hoạt lại
        co_the_kich_hoat_lai: daNghiViec,
      }];
      throw err;
    }
  }

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
        await hoatDongLog.create({
          loai: 'chuyen_cong_ty',
          muc_do: 'quan_trong',
          cong_nhan_id: id,
          nguoi_tuyen_id: updated.nguoi_tuyen_id,
          du_lieu: { tu_cong_ty_id: before.cong_ty_id, sang_cong_ty_id: updated.cong_ty_id },
          ghi_chu: `Chuyển công ty (#${before.cong_ty_id ?? '—'} → #${updated.cong_ty_id ?? '—'})`,
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

module.exports = { danhSach, chiTiet, taoMoi, capNhat, duyet, tuChoi, xoa, ganCongTyHangLoat };
