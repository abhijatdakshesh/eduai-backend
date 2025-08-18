const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

router.use(authenticateToken);
router.get('/reasons', attendanceController.getReasons);

module.exports = router;


