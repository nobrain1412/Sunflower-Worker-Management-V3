const congTyService = require('../services/congTyService');
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
  const { data, meta } = await congTyService.danhSach(req.query);
  sendSuccess(res, data, 'Thành công', 200, meta);
});

const getChiTiet = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.chiTiet(toPositiveInt(req.params.id, 'ID công ty'));
  sendSuccess(res, congTy);
});

const postTaoMoi = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.taoMoi(req.validatedBody);
  sendCreated(res, congTy, 'Thêm công ty thành công');
});

const putCapNhat = asyncWrapper(async (req, res) => {
  const congTy = await congTyService.capNhat(
    toPositiveInt(req.params.id, 'ID công ty'),
    req.validatedBody,
  );
  sendSuccess(res, congTy, 'Cập nhật thành công');
});

// POST /api/cong-ty/:id/quan-ly  { user_id }
const postGanQuanLy = asyncWrapper(async (req, res) => {
  await congTyService.ganQuanLy(
    toPositiveInt(req.params.id, 'ID công ty'),
    toPositiveInt(req.body.user_id, 'ID quản lý'),
  );
  sendSuccess(res, null, 'Đã gán quản lý vào công ty');
});

// DELETE /api/cong-ty/:id/quan-ly/:userId
const deleteGoQuanLy = asyncWrapper(async (req, res) => {
  await congTyService.goQuanLy(
    toPositiveInt(req.params.id, 'ID công ty'),
    toPositiveInt(req.params.userId, 'ID quản lý'),
  );
  sendSuccess(res, null, 'Đã gỡ quản lý khỏi công ty');
});

module.exports = { getDanhSach, getChiTiet, postTaoMoi, putCapNhat, postGanQuanLy, deleteGoQuanLy };
