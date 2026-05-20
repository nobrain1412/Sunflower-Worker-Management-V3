const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncWrapper = require('../utils/asyncWrapper');
const { sendSuccess, sendCreated } = require('../utils/response');
const todoModel = require('../models/todoModel');

const router = Router();
router.use(authenticate);

function toPositiveInt(v, name) {
  const n = Number.parseInt(v, 10);
  if (!Number.isInteger(n) || n <= 0) {
    const e = new Error(`${name} không hợp lệ`); e.statusCode = 400; throw e;
  }
  return n;
}

// ─── Categories ──────────────────────────────────────────────
router.get('/categories', asyncWrapper(async (req, res) => {
  const activeOnly = req.query.active === 'true';
  const rows = await todoModel.findAllCategories({ activeOnly });
  sendSuccess(res, rows);
}));

const categorySchema = z.object({
  ten:     z.string().min(1).max(100),
  icon:    z.string().max(20).optional(),
  mau_sac: z.string().max(20).optional(),
  thu_tu:  z.number().int().min(0).max(999).optional(),
  active:  z.boolean().optional(),
});

router.post('/categories', requireRole('admin'),
  validate(categorySchema),
  asyncWrapper(async (req, res) => {
    const row = await todoModel.createCategory(req.validatedBody);
    sendCreated(res, row, 'Tạo loại đầu việc thành công');
  }),
);

router.put('/categories/:id', requireRole('admin'),
  validate(categorySchema.partial()),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID category');
    const row = await todoModel.updateCategory(id, req.validatedBody);
    if (!row) { const e = new Error('Không tìm thấy category'); e.statusCode = 404; throw e; }
    sendSuccess(res, row, 'Cập nhật thành công');
  }),
);

router.delete('/categories/:id', requireRole('admin'),
  asyncWrapper(async (req, res) => {
    const id = toPositiveInt(req.params.id, 'ID category');
    const r = await todoModel.deleteCategory(id);
    if (!r) { const e = new Error('Không tìm thấy category'); e.statusCode = 404; throw e; }
    sendSuccess(res, null, 'Đã xoá');
  }),
);

// ─── Tasks ───────────────────────────────────────────────────
// GET /api/todo — list task của user hiện tại (scope=mine|given|both)
router.get('/', asyncWrapper(async (req, res) => {
  const scope = ['mine', 'given', 'both'].includes(req.query.scope) ? req.query.scope : 'both';
  const includeDone = req.query.done !== 'false';
  const rows = await todoModel.findTasks({
    userId: req.user.id, scope, includeDone, limit: 200,
  });
  sendSuccess(res, rows);
}));

const createTaskSchema = z.object({
  tieu_de:      z.string().min(1).max(300),
  mo_ta:        z.string().max(2000).optional(),
  category_id:  z.number().int().positive().nullable().optional(),
  assignee_id:  z.number().int().positive(),
  cong_nhan_id: z.number().int().positive().nullable().optional(),
  han:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Hạn phải dạng YYYY-MM-DD').nullable().optional(),
});

router.post('/', validate(createTaskSchema), asyncWrapper(async (req, res) => {
  const row = await todoModel.createTask({
    ...req.validatedBody,
    created_by: req.user.id,
  });
  sendCreated(res, row, 'Thêm việc thành công');
}));

const updateTaskSchema = z.object({
  tieu_de:      z.string().min(1).max(300).optional(),
  mo_ta:        z.string().max(2000).nullable().optional(),
  category_id:  z.number().int().positive().nullable().optional(),
  assignee_id:  z.number().int().positive().optional(),
  cong_nhan_id: z.number().int().positive().nullable().optional(),
  han:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// Chỉ assignee hoặc người tạo (hoặc admin) mới sửa được
async function loadAndCheckTask(req) {
  const id = toPositiveInt(req.params.id, 'ID task');
  const task = await todoModel.findTaskById(id);
  if (!task) { const e = new Error('Không tìm thấy task'); e.statusCode = 404; throw e; }
  const isOwner = task.created_by === req.user.id || task.assignee_id === req.user.id;
  if (!isOwner && req.user.vai_tro !== 'admin') {
    const e = new Error('Không có quyền thao tác task này'); e.statusCode = 403; throw e;
  }
  return task;
}

router.put('/:id', validate(updateTaskSchema), asyncWrapper(async (req, res) => {
  const task = await loadAndCheckTask(req);
  const row = await todoModel.updateTask(task.id, req.validatedBody);
  sendSuccess(res, row, 'Cập nhật thành công');
}));

// PATCH /api/todo/:id/toggle — bật/tắt hoàn thành
router.patch('/:id/toggle',
  validate(z.object({ hoan_thanh: z.boolean() })),
  asyncWrapper(async (req, res) => {
    const task = await loadAndCheckTask(req);
    const row = await todoModel.toggleTask(task.id, req.validatedBody.hoan_thanh, req.user.id);
    sendSuccess(res, row);
  }),
);

router.delete('/:id', asyncWrapper(async (req, res) => {
  const task = await loadAndCheckTask(req);
  await todoModel.deleteTask(task.id);
  sendSuccess(res, null, 'Đã xoá');
}));

module.exports = router;
