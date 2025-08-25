const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticateToken);

// Get results
router.get('/', resultsController.getResults);

// Get GPA
router.get('/gpa', resultsController.getGPA);

// Get transcript
router.get('/transcript', resultsController.getTranscript);

// Get years
router.get('/years', resultsController.getYears);

// Get semesters
router.get('/semesters', resultsController.getSemesters);

module.exports = router;
