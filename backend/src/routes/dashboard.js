const { Router } = require('express');
const { authenticate, scopeByRole } = require('../middleware/auth');
const ctrl = require('../controllers/dashboardController');

const router = Router();

router.use(authenticate, scopeByRole);

// Route duy nhất — tự điều hướng theo role
router.get('/', (req, res) => {
  const { vai_tro } = req.user;
  if (vai_tro === 'admin')    return ctrl.getAdminDashboard(req, res);
  if (vai_tro === 'quan_ly')  return ctrl.getQuanLyDashboard(req, res);
  return ctrl.getVenderDashboard(req, res);
});

module.exports = router;
