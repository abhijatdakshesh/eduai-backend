const db = require('../config/database');
const whatsappService = require('../services/whatsappService');
const aiCallService = require('../services/aiCallService');

/**
 * Send WhatsApp message to parent
 */
const sendWhatsAppMessage = async (req, res) => {
  try {
    const { student_id, parent_id, message, attendance_status, date, notes } = req.body;

    // Validate required fields
    if (!student_id || !parent_id || !message) {
      return res.status(400).json({
        success: false,
        message: 'student_id, parent_id, and message are required'
      });
    }

    // Get parent information
    const parentResult = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.phone, u.email
      FROM users u
      WHERE u.id = $1 AND u.user_type = 'parent'
    `, [parent_id]);

    if (parentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const parent = parentResult.rows[0];

    if (!parent.phone) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone number not available'
      });
    }

    // Send WhatsApp message
    const whatsappResult = await whatsappService.sendMessage(parent.phone, message);

    // Log communication
    const communicationResult = await db.query(`
      INSERT INTO communications (
        student_id, parent_id, type, status, message, attendance_status, 
        attendance_date, attendance_notes, sent_at, external_id, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at
    `, [
      student_id,
      parent_id,
      'whatsapp',
      whatsappResult.success ? 'sent' : 'failed',
      message,
      attendance_status || null,
      date || null,
      notes || null,
      whatsappResult.success ? new Date() : null,
      whatsappResult.messageId || null,
      whatsappResult.error || null
    ]);

    if (whatsappResult.success) {
      res.json({
        success: true,
        data: {
          message_id: whatsappResult.messageId,
          status: whatsappResult.status,
          sent_at: whatsappResult.sentAt,
          communication_id: communicationResult.rows[0].id
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send WhatsApp message',
        error: whatsappResult.error,
        communication_id: communicationResult.rows[0].id
      });
    }

  } catch (error) {
    console.error('Send WhatsApp message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Schedule AI call to parent
 */
const scheduleAICall = async (req, res) => {
  try {
    const { 
      student_id, 
      parent_id, 
      call_script, 
      attendance_status, 
      date, 
      notes, 
      scheduled_time 
    } = req.body;

    // Validate required fields
    if (!student_id || !parent_id || !call_script) {
      return res.status(400).json({
        success: false,
        message: 'student_id, parent_id, and call_script are required'
      });
    }

    // Get parent information
    const parentResult = await db.query(`
      SELECT u.id, u.first_name, u.last_name, u.phone, u.email
      FROM users u
      WHERE u.id = $1 AND u.user_type = 'parent'
    `, [parent_id]);

    if (parentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    const parent = parentResult.rows[0];

    if (!parent.phone) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone number not available'
      });
    }

    // Schedule AI call
    const callResult = await aiCallService.scheduleCall(
      parent.phone, 
      call_script, 
      { scheduledTime: scheduled_time ? new Date(scheduled_time) : null }
    );

    // Log communication
    const communicationResult = await db.query(`
      INSERT INTO communications (
        student_id, parent_id, type, status, call_script, attendance_status, 
        attendance_date, attendance_notes, scheduled_at, external_id, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, created_at
    `, [
      student_id,
      parent_id,
      'ai_call',
      callResult.success ? 'scheduled' : 'failed',
      call_script,
      attendance_status || null,
      date || null,
      notes || null,
      callResult.scheduledAt ? new Date(callResult.scheduledAt) : null,
      callResult.callId || null,
      callResult.error || null
    ]);

    if (callResult.success) {
      res.json({
        success: true,
        data: {
          call_id: callResult.callId,
          status: callResult.status,
          scheduled_at: callResult.scheduledAt,
          estimated_duration: callResult.estimatedDuration,
          communication_id: communicationResult.rows[0].id
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to schedule AI call',
        error: callResult.error,
        communication_id: communicationResult.rows[0].id
      });
    }

  } catch (error) {
    console.error('Schedule AI call error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get communication history for a student
 */
const getCommunicationHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type, status, limit = 50, offset = 0 } = req.query;

    let whereConditions = ['c.student_id = $1'];
    let queryParams = [studentId];
    let paramCount = 1;

    if (type) {
      paramCount++;
      whereConditions.push(`c.type = $${paramCount}`);
      queryParams.push(type);
    }

    if (status) {
      paramCount++;
      whereConditions.push(`c.status = $${paramCount}`);
      queryParams.push(status);
    }

    const query = `
      SELECT 
        c.id, c.type, c.status, c.message, c.call_script,
        c.attendance_status, c.attendance_date, c.attendance_notes,
        c.sent_at, c.scheduled_at, c.completed_at, c.duration,
        c.external_id, c.error_message, c.created_at,
        u.first_name as parent_first_name, u.last_name as parent_last_name,
        u.email as parent_email, u.phone as parent_phone
      FROM communications c
      JOIN users u ON c.parent_id = u.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY c.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM communications c
      WHERE ${whereConditions.join(' AND ')}
    `;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));

    res.json({
      success: true,
      data: {
        communications: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Get communication history error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update communication status (for webhooks)
 */
const updateCommunicationStatus = async (req, res) => {
  try {
    const { communicationId } = req.params;
    const { status, external_id, completed_at, duration, error_message } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const updateFields = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues = [status];
    let paramCount = 1;

    if (external_id) {
      paramCount++;
      updateFields.push(`external_id = $${paramCount}`);
      updateValues.push(external_id);
    }

    if (completed_at) {
      paramCount++;
      updateFields.push(`completed_at = $${paramCount}`);
      updateValues.push(new Date(completed_at));
    }

    if (duration) {
      paramCount++;
      updateFields.push(`duration = $${paramCount}`);
      updateValues.push(parseInt(duration));
    }

    if (error_message) {
      paramCount++;
      updateFields.push(`error_message = $${paramCount}`);
      updateValues.push(error_message);
    }

    paramCount++;
    updateValues.push(communicationId);

    const result = await db.query(`
      UPDATE communications 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, status, updated_at
    `, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Communication not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    console.error('Update communication status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get communication statistics
 */
const getCommunicationStats = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { days = 30 } = req.query;

    const statsQuery = `
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM communications
      WHERE student_id = $1 
        AND created_at >= CURRENT_DATE - INTERVAL '${parseInt(days)} days'
      GROUP BY type, status
      ORDER BY type, status
    `;

    const result = await db.query(statsQuery, [studentId]);

    const stats = {
      whatsapp: { sent: 0, failed: 0, delivered: 0 },
      ai_call: { scheduled: 0, completed: 0, failed: 0, cancelled: 0 }
    };

    result.rows.forEach(row => {
      if (stats[row.type] && stats[row.type][row.status] !== undefined) {
        stats[row.type][row.status] = parseInt(row.count);
      }
    });

    res.json({
      success: true,
      data: {
        period_days: parseInt(days),
        stats
      }
    });

  } catch (error) {
    console.error('Get communication stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  sendWhatsAppMessage,
  scheduleAICall,
  getCommunicationHistory,
  updateCommunicationStatus,
  getCommunicationStats
};
