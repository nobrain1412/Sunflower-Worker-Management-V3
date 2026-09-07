const congTyModel = require('../models/congTyModel');
const userModel   = require('../models/userModel');

async function danhSach(query, user) {
  const page  = Math.max(1, parseInt(query.page  || '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));

  const { rows, total } = await congTyModel.findAll({
    page, limit,
    sort:   query.sort,
    order:  query.order,
    active: query.active,
  });

  return {
    data: rows.map((ct) => anSoLuongTheoQuyen(ct, user)),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}

// Ẩn số lượng công nhân đang làm theo vai trò:
// - admin / kế toán  → thấy toàn bộ
// - quản lý          → chỉ thấy số công nhân của công ty mình quản lý
// - vender / CTV     → ẩn hoàn toàn
// Khi bị ẩn → trả so_luong_hien_tai = null để FE hiển thị dấu "—".
function anSoLuongTheoQuyen(congTy, user) {
  const vaiTro = user?.vai_tro;
  if (vaiTro === 'admin' || vaiTro === 'ke_toan') return congTy;

  if (vaiTro === 'quan_ly') {
    const congTyIds = Array.isArray(user?.cong_ty_ids) ? user.cong_ty_ids : [];
    if (congTyIds.includes(congTy.id)) return congTy;
  }

  return { ...congTy, so_luong_hien_tai: null };
}

// Danh sách công ty cho trang tuyển dụng công khai (không auth).
async function danhSachTuyenDung() {
  const rows = await congTyModel.findPublicTuyenDung();
  return rows;
}

// Thống kê thật cho trang tuyển dụng công khai (không auth).
async function thongKeTuyenDung() {
  return congTyModel.thongKeTuyenDung();
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

module.exports = { danhSach, danhSachTuyenDung, thongKeTuyenDung, chiTiet, taoMoi, capNhat, ganQuanLy, goQuanLy };
