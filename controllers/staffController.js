const db = require('../config/database');

// Get all staff members
const getStaff = async (req, res) => {
  try {
    const { 
      department, 
      search, 
      page = 1, 
      limit = 10 
    } = req.query;

    let whereConditions = ['u.user_type IN (\'teacher\', \'admin\')'];
    let queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.user_type,
        u.avatar_url
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY u.first_name, u.last_name
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    const staff = await db.query(query, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Staff members retrieved successfully',
      data: {
        staff: staff.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff members'
    });
  }
};

// Get staff member by ID
const getStaffById = async (req, res) => {
  try {
    const { id } = req.params;

    const staff = await db.query(`
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.user_type,
        u.avatar_url,
        u.date_of_birth,
        u.gender
      FROM users u
      WHERE u.id = $1 AND u.user_type IN ('teacher', 'admin')
    `, [id]);

    if (staff.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    res.json({
      success: true,
      message: 'Staff member retrieved successfully',
      data: staff.rows[0]
    });

  } catch (error) {
    console.error('Get staff member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff member'
    });
  }
};

// Get staff departments
const getStaffDepartments = async (req, res) => {
  try {
    const departments = await db.query(`
      SELECT 
        id,
        name,
        code,
        description
      FROM departments
      ORDER BY name
    `);

    res.json({
      success: true,
      message: 'Staff departments retrieved successfully',
      data: departments.rows
    });

  } catch (error) {
    console.error('Get staff departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve staff departments'
    });
  }
};

// Contact staff member
const contactStaff = async (req, res) => {
  try {
    const userId = req.user.id;
    const { staffId } = req.params;
    const { subject, message, contact_method } = req.body;

    // Check if staff member exists
    const staff = await db.query(`
      SELECT id, first_name, last_name, email
      FROM users
      WHERE id = $1 AND user_type IN ('teacher', 'admin')
    `, [staffId]);

    if (staff.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Staff member not found'
      });
    }

    // Here you would typically send an email or create a contact request
    // For now, we'll just return a success message
    // In a real implementation, you might:
    // 1. Send an email to the staff member
    // 2. Create a contact request record in the database
    // 3. Send a notification

    res.json({
      success: true,
      message: 'Contact request sent successfully',
      data: {
        staff_name: `${staff.rows[0].first_name} ${staff.rows[0].last_name}`,
        contact_method,
        subject,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Contact staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send contact request'
    });
  }
};

module.exports = {
  getStaff,
  getStaffById,
  getStaffDepartments,
  contactStaff
};
