const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobsController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/', jobsController.getJobs);
router.get('/types', jobsController.getJobTypes);
router.get('/locations', jobsController.getJobLocations);
router.get('/:id', jobsController.getJobById);

// Protected routes
router.use(authenticateToken);

// Apply for job
router.post('/:id/apply', jobsController.applyForJob);

// Get applied jobs
router.get('/applied', jobsController.getAppliedJobs);

module.exports = router;
