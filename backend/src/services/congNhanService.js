const congNhanModel = require('../models/congNhanModel');
const hoatDongLog = require('../models/hoatDongLogModel');
const { sanitizeForRole, sanitizeListForRole } = require('../utils/sanitizeCongNhan');

async function danhSach(query, scope, vaiTro) {
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
    vender_id:  query.vender_id ? parseInt(query.vender_id, 10) : undefined,
    cong_ty_id: query.cong_ty_id ? parseInt(query.cong_ty_id, 10) : undefined,
    tinh:       query.tinh || undefined,
    ngay:       query.ngay || undefined,
    scope,
  });

  return {
    data: sanitizeListForRole(rows, vaiTro),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

async function chiTiet(id, scope, vaiTro) {
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
    const allowed = (scope.ids ?? []).includes(congNhan.cong_ty_id);
    if (!allowed) {
      const err = new Error('Bạn không có quyền xem công nhân này');
      err.statusCode = 403; err.code = 'FORBIDDEN';
      throw err;
    }
  }
  return sanitizeForRole(congNhan, vaiTro);
}

async function taoMoi(data) {
  if (data.cccd) {
    const existing = await congNhanModel.findByCccd(data.cccd);
    if (existing) {
      const err = new Error('CCCD đã tồn tại trong hệ thống');
      err.statusCode = 409;
      err.code = 'DUPLICATE_CCCD';
      throw err;
    }
  }

  return congNhanModel.create(data);
}

async function capNhat(id, data, actorUserId = null) {
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

  const updated = await congNhanModel.update(id, data);
  if (!updated) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
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

async function xoa(id) {
  let deleted;
  try {
    deleted = await congNhanModel.hardDelete(id);
  } catch (error) {
    if (error.code === '23503') {
      const err = new Error('Công nhân đang có dữ liệu liên kết (phân công, tài chính, chỗ ở...). Vui lòng xoá dữ liệu liên quan trước.');
      err.statusCode = 409;
      err.code = 'CONG_NHAN_HAS_RELATIONS';
      throw err;
    }
    throw error;
  }
  if (!deleted) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
}

module.exports = { danhSach, chiTiet, taoMoi, capNhat, xoa };
