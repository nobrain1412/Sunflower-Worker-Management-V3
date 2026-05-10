const congTyService = require('../services/congTyService');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');

const getDanhSach = asyncWrapper(async (req, res) => {
  const { data, meta } = await congTyService.danhSach(req.query);
  sendSuccess(res, data, 'Thành công', 200, meta);
});

const getChiTiet = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.chiTiet(parseInt(req.params.id, 10));
  sendSuccess(res, congTy);
});

const postTaoMoi = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.taoMoi(req.validatedBody);
  sendCreated(res, congTy, 'Thêm công ty thành công');
});

const putCapNhat = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.capNhat(
    parseInt(req.params.id, 10),
    req.validatedBody,
  );
  sendSuccess(res, congTy, 'Cập nhật thành công');
});

// POST /api/cong-ty/:id/quan-ly  { user_id }
const postGanQuanLy = asyncWrapper(async (req, res) => {
  await congTyService.ganQuanLy(
    parseInt(req.params.id, 10),
    parseInt(req.body.user_id, 10),
  );
  sendSuccess(res, null, 'Đã gán quản lý vào công ty');
});

// DELETE /api/cong-ty/:id/quan-ly/:userId
const deleteGoQuanLy = asyncWrapper(async (req, res) => {
  await congTyService.goQuanLy(
    parseInt(req.params.id, 10),
    parseInt(req.params.userId, 10),
  );
  sendSuccess(res, null, 'Đã gỡ quản lý khỏi công ty');
});

module.exports = { getDanhSach, getChiTiet, postTaoMoi, putCapNhat, postGanQuanLy, deleteGoQuanLy };
