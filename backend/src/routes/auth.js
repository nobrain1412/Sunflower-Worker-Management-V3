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

const dangKySchema = z.object({
  ten_dang_nhap:    z.string().trim().min(3, 'Tên đăng nhập tối thiểu 3 ký tự').max(50)
                     .regex(/^[a-zA-Z0-9_.]+$/, 'Tên đăng nhập chỉ gồm chữ, số, dấu chấm hoặc gạch dưới'),
  ho_ten:           z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100),
  so_dien_thoai:    z.string().trim().min(8, 'Số điện thoại không hợp lệ').max(20)
                     .regex(/^[0-9+\s.-]+$/, 'Số điện thoại không hợp lệ'),
  mat_khau:         z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(100),
  nhap_lai_mat_khau: z.string().min(1, 'Vui lòng nhập lại mật khẩu'),
}).refine((d) => d.mat_khau === d.nhap_lai_mat_khau, {
  message: 'Mật khẩu nhập lại không khớp',
  path:    ['nhap_lai_mat_khau'],
});

router.post('/login',         validate(loginSchema), ctrl.postLogin);
router.post('/dang-ky',       validate(dangKySchema), ctrl.postDangKy);
router.post('/refresh',       ctrl.postRefresh);
router.post('/logout',        ctrl.postLogout);
router.post('/doi-mat-khau',  authenticate, validate(doiMatKhauSchema), ctrl.postDoiMatKhau);

// ─── Hồ sơ cá nhân (self-service) ────────────────────────────
const capNhatHoSoSchema = z.object({
  ho_ten:        z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100).optional(),
  so_dien_thoai: z.string().trim().max(20).optional().or(z.literal('')),
  ngan_hang:     z.string().trim().max(100).optional().or(z.literal('')),
  so_tai_khoan:  z.string().trim().max(50).optional().or(z.literal('')),
  ten_chu_tk:    z.string().trim().max(100).optional().or(z.literal('')),
});

router.get('/me', authenticate, ctrl.getMe);
router.put('/me', authenticate, validate(capNhatHoSoSchema), ctrl.putMe);

module.exports = router;
