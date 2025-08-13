const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.get('/', servicesController.getServices);
router.get('/categories', servicesController.getServiceCategories);
router.get('/:id', servicesController.getServiceById);

// Protected routes
router.use(authenticateToken);

// Book service
router.post('/:serviceId/book', servicesController.bookService);

// Get user bookings
router.get('/bookings', servicesController.getUserBookings);

// Update booking
router.put('/bookings/:bookingId', servicesController.updateBooking);

// Cancel booking
router.delete('/bookings/:bookingId', servicesController.cancelBooking);

module.exports = router;
