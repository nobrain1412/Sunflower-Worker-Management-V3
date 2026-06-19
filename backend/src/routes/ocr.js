const { Router }  = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadOcr }  = require('../middleware/uploadOcr');
const asyncWrapper   = require('../utils/asyncWrapper');
const ctrl           = require('../controllers/ocrController');

const router = Router();

router.use(authenticate);

router.post('/scan',
  requireRole('admin', 'quan_ly', 'vender'),
  uploadOcr.single('anh'),
  asyncWrapper(ctrl.postScan),
);

// Chỉ lưu ảnh CCCD (luồng quét QR) — không chạy OCR
router.post('/upload-anh',
  requireRole('admin', 'quan_ly', 'vender'),
  uploadOcr.single('anh'),
  asyncWrapper(ctrl.postUploadAnh),
);

router.post('/:id/approve',
  requireRole('admin', 'quan_ly'),
  asyncWrapper(ctrl.postApprove),
);

router.post('/:id/reject',
  requireRole('admin', 'quan_ly'),
  asyncWrapper(ctrl.postReject),
);

module.exports = router;
