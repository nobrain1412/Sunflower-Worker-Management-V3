const congNhanService = require('../services/congNhanService');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');

function toPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const e = new Error(`${fieldName} không hợp lệ`);
    e.statusCode = 400;
    e.code = 'VALIDATION_ERROR';
    throw e;
  }
  return parsed;
}

const getDanhSach = asyncWrapper(async (req, res) => {
  // req.scope được gắn bởi scopeByRole middleware
  const { data, meta } = await congNhanService.danhSach(
    req.query, req.scope, req.user?.vai_tro, req.user?.id,
  );
  sendSuccess(res, data, 'Thành công', 200, meta);
});

const getChiTiet = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.chiTiet(
    toPositiveInt(req.params.id, 'ID công nhân'),
    req.scope,
    req.user?.vai_tro,
    req.user?.id,
  );
  sendSuccess(res, congNhan);
});

const postTaoMoi = asyncWrapper(async (req, res) => {
  // Admin/quan_ly có thể chỉ định người tuyển; vender luôn là chính họ
  const body = { ...req.validatedBody };
  const isPrivileged = req.user.vai_tro === 'admin' || req.user.vai_tro === 'quan_ly';
  body.nguoi_tuyen_id = (isPrivileged && body.nguoi_tuyen_id)
    ? body.nguoi_tuyen_id
    : req.user.id;
  const congNhan = await congNhanService.taoMoi(body, req.user.id);
  sendCreated(res, congNhan, 'Thêm công nhân thành công');
});

const putCapNhat = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.capNhat(
    toPositiveInt(req.params.id, 'ID công nhân'),
    req.validatedBody,
    req.user?.id ?? null,
    req.scope,
  );
  sendSuccess(res, congNhan, 'Cập nhật thành công');
});

// Duyệt CN "đợi việc" → chính thức vào làm (moi_vao)
const postDuyet = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.duyet(
    toPositiveInt(req.params.id, 'ID công nhân'),
    req.user,
  );
  sendSuccess(res, congNhan, 'Đã duyệt công nhân vào làm');
});

const deleteXoa = asyncWrapper(async (req, res) => {
  await congNhanService.xoa(toPositiveInt(req.params.id, 'ID công nhân'), req.user);
  sendSuccess(res, null, 'Đã xoá công nhân');
});

// Gán công ty hàng loạt cho nhiều CN chưa có công ty
const postGanCongTy = asyncWrapper(async (req, res) => {
  const { ids, cong_ty_id, trang_thai } = req.validatedBody;
  const result = await congNhanService.ganCongTyHangLoat({
    ids,
    congTyId: cong_ty_id,
    trangThai: trang_thai,
    user: req.user,
    scope: req.scope,
  });
  sendSuccess(res, result, `Đã gán công ty cho ${result.assigned} công nhân`);
});

module.exports = { getDanhSach, getChiTiet, postTaoMoi, putCapNhat, postDuyet, deleteXoa, postGanCongTy };
