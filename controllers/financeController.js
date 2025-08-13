const db = require('../config/database');

// Get student fees
const getFees = async (req, res) => {
  try {
    const userId = req.user.id;
    const { semester, year } = req.query;

    let whereConditions = ['f.student_id = $1'];
    let queryParams = [userId];
    let paramCount = 1;

    if (semester) {
      paramCount++;
      whereConditions.push(`f.semester = $${paramCount}`);
      queryParams.push(semester);
    }

    if (year) {
      paramCount++;
      whereConditions.push(`f.year = $${paramCount}`);
      queryParams.push(year);
    }

    const fees = await db.query(`
      SELECT 
        f.id,
        f.semester,
        f.year,
        f.tuition_fee,
        f.library_fee,
        f.lab_fee,
        f.activity_fee,
        f.total_fee,
        f.paid_amount,
        f.due_date,
        f.status,
        f.created_at
      FROM fees f
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY f.year DESC, f.semester DESC
    `, queryParams);

    res.json({
      success: true,
      message: 'Fees retrieved successfully',
      data: fees.rows
    });

  } catch (error) {
    console.error('Get fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve fees'
    });
  }
};

// Get fee breakdown
const getFeeBreakdown = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feeId } = req.params;

    const fee = await db.query(`
      SELECT 
        f.id,
        f.semester,
        f.year,
        f.tuition_fee,
        f.library_fee,
        f.lab_fee,
        f.activity_fee,
        f.total_fee,
        f.paid_amount,
        f.due_date,
        f.status,
        (f.total_fee - f.paid_amount) as remaining_amount
      FROM fees f
      WHERE f.id = $1 AND f.student_id = $2
    `, [feeId, userId]);

    if (fee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    const breakdown = {
      tuition_fee: fee.rows[0].tuition_fee,
      library_fee: fee.rows[0].library_fee,
      lab_fee: fee.rows[0].lab_fee,
      activity_fee: fee.rows[0].activity_fee,
      total_fee: fee.rows[0].total_fee,
      paid_amount: fee.rows[0].paid_amount,
      remaining_amount: fee.rows[0].remaining_amount
    };

    res.json({
      success: true,
      message: 'Fee breakdown retrieved successfully',
      data: breakdown
    });

  } catch (error) {
    console.error('Get fee breakdown error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve fee breakdown'
    });
  }
};

// Make payment
const makePayment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { feeId } = req.params;
    const { amount, payment_method, transaction_id, notes } = req.body;

    // Check if fee exists and belongs to user
    const fee = await db.query(`
      SELECT id, total_fee, paid_amount, status
      FROM fees
      WHERE id = $1 AND student_id = $2
    `, [feeId, userId]);

    if (fee.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fee not found'
      });
    }

    const remainingAmount = fee.rows[0].total_fee - fee.rows[0].paid_amount;

    if (amount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds remaining fee amount'
      });
    }

    // Create payment record
    await db.query(`
      INSERT INTO payments (fee_id, amount, payment_method, transaction_id, notes)
      VALUES ($1, $2, $3, $4, $5)
    `, [feeId, amount, payment_method, transaction_id, notes]);

    // Update fee paid amount
    const newPaidAmount = fee.rows[0].paid_amount + parseFloat(amount);
    const newStatus = newPaidAmount >= fee.rows[0].total_fee ? 'paid' : 'partial';

    await db.query(`
      UPDATE fees
      SET paid_amount = $1, status = $2
      WHERE id = $3
    `, [newPaidAmount, newStatus, feeId]);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: {
        payment_amount: amount,
        new_paid_amount: newPaidAmount,
        new_status: newStatus
      }
    });

  } catch (error) {
    console.error('Make payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment'
    });
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const payments = await db.query(`
      SELECT 
        p.id,
        p.amount,
        p.payment_method,
        p.transaction_id,
        p.payment_date,
        p.status,
        p.notes,
        f.semester,
        f.year
      FROM payments p
      JOIN fees f ON p.fee_id = f.id
      WHERE f.student_id = $1
      ORDER BY p.payment_date DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM payments p
      JOIN fees f ON p.fee_id = f.id
      WHERE f.student_id = $1
    `, [userId]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Payment history retrieved successfully',
      data: {
        payments: payments.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history'
    });
  }
};

// Get scholarships
const getScholarships = async (req, res) => {
  try {
    const scholarships = await db.query(`
      SELECT 
        id,
        name,
        description,
        amount,
        eligibility_criteria,
        application_deadline,
        is_active
      FROM scholarships
      WHERE is_active = true
      ORDER BY application_deadline ASC
    `);

    res.json({
      success: true,
      message: 'Scholarships retrieved successfully',
      data: scholarships.rows
    });

  } catch (error) {
    console.error('Get scholarships error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve scholarships'
    });
  }
};

// Apply for scholarship
const applyForScholarship = async (req, res) => {
  try {
    const userId = req.user.id;
    const { scholarshipId } = req.params;
    const { documents_url } = req.body;

    // Check if scholarship exists and is active
    const scholarship = await db.query(`
      SELECT id, application_deadline FROM scholarships
      WHERE id = $1 AND is_active = true
    `, [scholarshipId]);

    if (scholarship.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scholarship not found'
      });
    }

    // Check if deadline has passed
    if (scholarship.rows[0].application_deadline && new Date() > new Date(scholarship.rows[0].application_deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

    // Check if already applied
    const existingApplication = await db.query(`
      SELECT id FROM scholarship_applications
      WHERE scholarship_id = $1 AND student_id = $2
    `, [scholarshipId, userId]);

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already applied for this scholarship'
      });
    }

    // Apply for scholarship
    await db.query(`
      INSERT INTO scholarship_applications (scholarship_id, student_id, documents_url)
      VALUES ($1, $2, $3)
    `, [scholarshipId, userId, documents_url]);

    res.json({
      success: true,
      message: 'Successfully applied for scholarship'
    });

  } catch (error) {
    console.error('Apply for scholarship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply for scholarship'
    });
  }
};

// Get applied scholarships
const getAppliedScholarships = async (req, res) => {
  try {
    const userId = req.user.id;

    const appliedScholarships = await db.query(`
      SELECT 
        sa.id as application_id,
        sa.application_date,
        sa.status,
        sa.documents_url,
        s.id as scholarship_id,
        s.name,
        s.description,
        s.amount,
        s.application_deadline
      FROM scholarship_applications sa
      JOIN scholarships s ON sa.scholarship_id = s.id
      WHERE sa.student_id = $1
      ORDER BY sa.application_date DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'Applied scholarships retrieved successfully',
      data: appliedScholarships.rows
    });

  } catch (error) {
    console.error('Get applied scholarships error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve applied scholarships'
    });
  }
};

module.exports = {
  getFees,
  getFeeBreakdown,
  makePayment,
  getPaymentHistory,
  getScholarships,
  applyForScholarship,
  getAppliedScholarships
};
