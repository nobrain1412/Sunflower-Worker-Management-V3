const congNhanModel = require('../models/congNhanModel');

async function danhSach(query, scope) {
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
    data: rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

async function chiTiet(id, scope) {
  const congNhan = await congNhanModel.findById(id);
  if (!congNhan) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Kiểm tra quyền xem: vender chỉ xem CN mình tuyển
  if (scope?.type === 'vender' && congNhan.nguoi_tuyen_id !== scope.userId) {
    const err = new Error('Bạn không có quyền xem công nhân này');
    err.statusCode = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  return congNhan;
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

async function capNhat(id, data) {
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

  const updated = await congNhanModel.update(id, data);
  if (!updated) {
    const err = new Error('Không tìm thấy công nhân');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
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
