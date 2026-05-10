const congNhanService = require('../services/congNhanService');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated, sendNotFound } = require('../utils/response');

const getDanhSach = asyncWrapper(async (req, res) => {
  // req.scope được gắn bởi scopeByRole middleware
  const { data, meta } = await congNhanService.danhSach(req.query, req.scope);
  sendSuccess(res, data, 'Thành công', 200, meta);
});

const getChiTiet = asyncWrapper(async (req, res) => {
  const congNhan = await congNhanService.chiTiet(parseInt(req.params.id, 10), req.scope);
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
    parseInt(req.params.id, 10),
    req.validatedBody,
  );
  sendSuccess(res, congNhan, 'Cập nhật thành công');
});

const deleteXoa = asyncWrapper(async (req, res) => {
  await congNhanService.xoa(parseInt(req.params.id, 10));
  sendSuccess(res, null, 'Đã xoá công nhân');
});

module.exports = { getDanhSach, getChiTiet, postTaoMoi, putCapNhat, deleteXoa };
