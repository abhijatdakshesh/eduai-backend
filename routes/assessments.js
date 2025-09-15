const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const ctrl = require('../controllers/assessmentsController');

// All endpoints require auth; teachers and admins are allowed
router.use(authenticateToken, requireUserType(['teacher', 'admin']));

router.post('/', ctrl.createAssessment);
router.get('/:id', ctrl.getAssessment);
router.put('/:id', ctrl.updateAssessment);
router.post('/:id/lock', ctrl.lockAssessment);

router.post('/:id/marks/bulk', ctrl.upsertMarksBulk);
router.get('/:id/marks', ctrl.getMarks);

router.post('/:id/publish', ctrl.publishAssessment);

router.post('/:id/report', ctrl.generateReport);
router.get('/:id/report', ctrl.getReport);

router.post('/:id/notify', ctrl.notify);
router.get('/:id/audit', ctrl.getAudit);

module.exports = router;


