const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/authController');

const router = Router();

const loginSchema = z.object({
  ten_dang_nhap: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  mat_khau:      z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

router.post('/login',   validate(loginSchema), ctrl.postLogin);
router.post('/refresh', ctrl.postRefresh);
router.post('/logout',  ctrl.postLogout);

module.exports = router;
