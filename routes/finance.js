const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get fees
router.get('/fees', financeController.getFees);

// Get fee breakdown
router.get('/fees/:feeId/breakdown', financeController.getFeeBreakdown);

// Make payment
router.post('/fees/:feeId/payment', financeController.makePayment);

// Get payment history
router.get('/payment-history', financeController.getPaymentHistory);

// Get scholarships
router.get('/scholarships', financeController.getScholarships);

// Apply for scholarship
router.post('/scholarships/:scholarshipId/apply', financeController.applyForScholarship);

// Get applied scholarships
router.get('/scholarships/applied', financeController.getAppliedScholarships);

module.exports = router;
