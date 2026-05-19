const { Router } = require('express');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

const router = Router();

const loginSchema = z.object({
  ten_dang_nhap: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  mat_khau:      z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const doiMatKhauSchema = z.object({
  mat_khau_cu:  z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  mat_khau_moi: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự').max(100),
});

router.post('/login',         validate(loginSchema), ctrl.postLogin);
router.post('/refresh',       ctrl.postRefresh);
router.post('/logout',        ctrl.postLogout);
router.post('/doi-mat-khau',  authenticate, validate(doiMatKhauSchema), ctrl.postDoiMatKhau);

module.exports = router;
