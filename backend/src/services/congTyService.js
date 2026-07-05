const congTyModel = require('../models/congTyModel');
const userModel   = require('../models/userModel');

async function danhSach(query) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

  const { rows, total } = await congTyModel.findAll({
    page, limit,
    sort:   query.sort,
    order:  query.order,
    active: query.active,
  });

  return {
    data: rows,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

// Danh sách công ty cho trang tuyển dụng công khai (không auth).
async function danhSachTuyenDung() {
  const rows = await congTyModel.findPublicTuyenDung();
  return rows;
}

async function chiTiet(id) {
  const congTy = await congTyModel.findById(id);
  if (!congTy) {
    const err = new Error('Không tìm thấy công ty');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }
  const quan_ly = await congTyModel.findQuanLy(id);
  return { ...congTy, quan_ly };
}

async function taoMoi(data) {
  return congTyModel.create(data);
}

async function capNhat(id, data) {
  const updated = await congTyModel.update(id, data);
  if (!updated) {
    const err = new Error('Không tìm thấy công ty');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }
  return updated;
}

async function ganQuanLy(congTyId, userId) {
  // Kiểm tra user tồn tại và có role quan_ly
  const user = await userModel.findById(userId);
  if (!user) {
    const err = new Error('Không tìm thấy người dùng');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }
  if (user.vai_tro !== 'quan_ly') {
    const err = new Error('Người dùng không phải quản lý');
    err.statusCode = 400; err.code = 'INVALID_ROLE';
    throw err;
  }
  return congTyModel.assignQuanLy(congTyId, userId);
}

async function goQuanLy(congTyId, userId) {
  const removed = await congTyModel.removeQuanLy(congTyId, userId);
  if (!removed) {
    const err = new Error('Phân công không tồn tại');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }
}

module.exports = { danhSach, danhSachTuyenDung, chiTiet, taoMoi, capNhat, ganQuanLy, goQuanLy };
