const db = require('../config/database');

// Get all campus services
const getServices = async (req, res) => {
  try {
    const { category } = req.query;

    let whereConditions = ['cs.is_available = true'];
    let queryParams = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      whereConditions.push(`cs.category = $${paramCount}`);
      queryParams.push(category);
    }

    const services = await db.query(`
      SELECT 
        cs.id,
        cs.name,
        cs.description,
        cs.category,
        cs.location,
        cs.contact_info,
        cs.is_available
      FROM campus_services cs
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY cs.category, cs.name
    `, queryParams);

    res.json({
      success: true,
      message: 'Campus services retrieved successfully',
      data: services.rows
    });

  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve campus services'
    });
  }
};

// Get service by ID
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await db.query(`
      SELECT 
        cs.id,
        cs.name,
        cs.description,
        cs.category,
        cs.location,
        cs.contact_info,
        cs.is_available
      FROM campus_services cs
      WHERE cs.id = $1 AND cs.is_available = true
    `, [id]);

    if (service.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      message: 'Service retrieved successfully',
      data: service.rows[0]
    });

  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service'
    });
  }
};

// Get service categories
const getServiceCategories = async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT DISTINCT category
      FROM campus_services
      WHERE is_available = true
      ORDER BY category
    `);

    res.json({
      success: true,
      message: 'Service categories retrieved successfully',
      data: categories.rows.map(row => row.category)
    });

  } catch (error) {
    console.error('Get service categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service categories'
    });
  }
};

// Book a service
const bookService = async (req, res) => {
  try {
    const userId = req.user.id;
    const { serviceId } = req.params;
    const { booking_date, booking_time, notes } = req.body;

    // Check if service exists and is available
    const service = await db.query(`
      SELECT id, name FROM campus_services
      WHERE id = $1 AND is_available = true
    `, [serviceId]);

    if (service.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found or unavailable'
      });
    }

    // Check if booking date is in the future
    const bookingDateTime = new Date(`${booking_date} ${booking_time}`);
    if (bookingDateTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Booking date and time must be in the future'
      });
    }

    // Check for conflicting bookings (optional - can be enhanced)
    const conflictingBooking = await db.query(`
      SELECT id FROM service_bookings
      WHERE service_id = $1 AND booking_date = $2 AND booking_time = $3 AND status != 'cancelled'
    `, [serviceId, booking_date, booking_time]);

    if (conflictingBooking.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'This time slot is already booked'
      });
    }

    // Create booking
    const booking = await db.query(`
      INSERT INTO service_bookings (service_id, student_id, booking_date, booking_time, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, booking_date, booking_time, status
    `, [serviceId, userId, booking_date, booking_time, notes]);

    res.json({
      success: true,
      message: 'Service booked successfully',
      data: {
        booking_id: booking.rows[0].id,
        service_name: service.rows[0].name,
        booking_date: booking.rows[0].booking_date,
        booking_time: booking.rows[0].booking_time,
        status: booking.rows[0].status
      }
    });

  } catch (error) {
    console.error('Book service error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book service'
    });
  }
};

// Get user's service bookings
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.id;

    const bookings = await db.query(`
      SELECT 
        sb.id,
        sb.booking_date,
        sb.booking_time,
        sb.status,
        sb.notes,
        sb.created_at,
        cs.name as service_name,
        cs.category as service_category,
        cs.location as service_location
      FROM service_bookings sb
      JOIN campus_services cs ON sb.service_id = cs.id
      WHERE sb.student_id = $1
      ORDER BY sb.booking_date DESC, sb.booking_time DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'Service bookings retrieved successfully',
      data: bookings.rows
    });

  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve service bookings'
    });
  }
};

// Update booking
const updateBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;
    const { booking_date, booking_time, notes } = req.body;

    // Check if booking exists and belongs to user
    const booking = await db.query(`
      SELECT id, status FROM service_bookings
      WHERE id = $1 AND student_id = $2
    `, [bookingId, userId]);

    if (booking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.rows[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update cancelled booking'
      });
    }

    // Update booking
    await db.query(`
      UPDATE service_bookings
      SET booking_date = $1, booking_time = $2, notes = $3
      WHERE id = $4
    `, [booking_date, booking_time, notes, bookingId]);

    res.json({
      success: true,
      message: 'Booking updated successfully'
    });

  } catch (error) {
    console.error('Update booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking'
    });
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;

    // Check if booking exists and belongs to user
    const booking = await db.query(`
      SELECT id, status FROM service_bookings
      WHERE id = $1 AND student_id = $2
    `, [bookingId, userId]);

    if (booking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.rows[0].status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Cancel booking
    await db.query(`
      UPDATE service_bookings
      SET status = 'cancelled'
      WHERE id = $1
    `, [bookingId]);

    res.json({
      success: true,
      message: 'Booking cancelled successfully'
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking'
    });
  }
};

module.exports = {
  getServices,
  getServiceById,
  getServiceCategories,
  bookService,
  getUserBookings,
  updateBooking,
  cancelBooking
};
