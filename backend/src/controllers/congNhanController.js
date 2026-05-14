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
  const { data, meta } = await congNhanService.danhSach(req.query, req.scope);
  sendSuccess(res, data, 'Thành công', 200, meta);
});

const getChiTiet = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.chiTiet(toPositiveInt(req.params.id, 'ID công nhân'), req.scope);
  sendSuccess(res, congNhan);
});

const postTaoMoi = asyncWrapper(async (req, res) => {
  // Admin/quan_ly có thể chỉ định người tuyển; vender luôn là chính họ
  const body = { ...req.validatedBody };
  const isPrivileged = req.user.vai_tro === 'admin' || req.user.vai_tro === 'quan_ly';
  body.nguoi_tuyen_id = (isPrivileged && body.nguoi_tuyen_id)
    ? body.nguoi_tuyen_id
    : req.user.id;
  const congNhan = await congNhanService.taoMoi(body);
  sendCreated(res, congNhan, 'Thêm công nhân thành công');
});

const putCapNhat = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.capNhat(
    toPositiveInt(req.params.id, 'ID công nhân'),
    req.validatedBody,
  );
  sendSuccess(res, congNhan, 'Cập nhật thành công');
});

const deleteXoa = asyncWrapper(async (req, res) => {
  await congNhanService.xoa(toPositiveInt(req.params.id, 'ID công nhân'));
  sendSuccess(res, null, 'Đã xoá công nhân');
});

module.exports = { getDanhSach, getChiTiet, postTaoMoi, putCapNhat, deleteXoa };
