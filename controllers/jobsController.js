const db = require('../config/database');

// Get all jobs with filters
const getJobs = async (req, res) => {
  try {
    const { 
      search, 
      type, 
      location, 
      page = 1, 
      limit = 10 
    } = req.query;

    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(`(j.title ILIKE $${paramCount} OR j.company ILIKE $${paramCount} OR j.description ILIKE $${paramCount})`);
      queryParams.push(`%${search}%`);
    }

    if (type) {
      paramCount++;
      whereConditions.push(`j.job_type = $${paramCount}`);
      queryParams.push(type);
    }

    if (location) {
      paramCount++;
      whereConditions.push(`j.location ILIKE $${paramCount}`);
      queryParams.push(`%${location}%`);
    }

    const offset = (page - 1) * limit;
    paramCount++;
    queryParams.push(limit);
    paramCount++;
    queryParams.push(offset);

    const query = `
      SELECT 
        j.id,
        j.title,
        j.company,
        j.location,
        j.job_type,
        j.salary_min,
        j.salary_max,
        j.description,
        j.requirements,
        j.posted_date,
        j.deadline,
        j.application_url,
        COUNT(ja.id) as application_count
      FROM jobs j
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY j.id
      ORDER BY j.posted_date DESC
      LIMIT $${paramCount - 1} OFFSET $${paramCount}
    `;

    let jobs;
    try {
      jobs = await db.query(query, queryParams);
    } catch (primaryError) {
      // Fallback for environments missing job_applications table
      try {
        const fallbackQuery = `
          SELECT 
            j.id,
            j.title,
            j.company,
            j.location,
            j.job_type,
            j.salary_min,
            j.salary_max,
            j.description,
            j.requirements,
            j.posted_date,
            j.deadline,
            j.application_url,
            0 as application_count
          FROM jobs j
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY j.posted_date DESC
          LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `;
        jobs = await db.query(fallbackQuery, queryParams);
      } catch (fallbackError) {
        console.error('Get jobs error (fallback failed):', fallbackError);
        throw primaryError;
      }
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM jobs j
      WHERE ${whereConditions.join(' AND ')}
    `;
    
    let total = 0;
    try {
      const countResult = await db.query(countQuery, queryParams.slice(0, -2));
      total = parseInt(countResult.rows[0].total);
    } catch (_) {
      // If fallback path was taken and count query fails (e.g., missing tables), approximate from result length
      total = jobs.rows.length;
    }

    res.json({
      success: true,
      message: 'Jobs retrieved successfully',
      data: {
        jobs: jobs.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve jobs'
    });
  }
};

// Get job by ID
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const job = await db.query(`
      SELECT 
        j.id,
        j.title,
        j.company,
        j.location,
        j.job_type,
        j.salary_min,
        j.salary_max,
        j.description,
        j.requirements,
        j.posted_date,
        j.deadline,
        j.application_url,
        u.first_name || ' ' || u.last_name as posted_by,
        COUNT(ja.id) as application_count,
        CASE WHEN ja2.id IS NOT NULL THEN true ELSE false END as has_applied
      FROM jobs j
      LEFT JOIN users u ON j.created_by = u.id
      LEFT JOIN job_applications ja ON j.id = ja.job_id
      LEFT JOIN job_applications ja2 ON j.id = ja2.job_id AND ja2.student_id = $2
      WHERE j.id = $1
      GROUP BY j.id, u.first_name, u.last_name, ja2.id
    `, [id, userId]);

    if (job.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      message: 'Job retrieved successfully',
      data: job.rows[0]
    });

  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job'
    });
  }
};

// Apply for a job
const applyForJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { cover_letter, resume_url } = req.body;

    // Check if job exists and is active
    const job = await db.query(`
      SELECT id, deadline, application_url FROM jobs
      WHERE id = $1 AND is_active = true
    `, [id]);

    if (job.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // If external application URL is provided, return it for client-side redirect
    if (job.rows[0].application_url) {
      return res.json({
        success: true,
        message: 'External application URL available',
        data: { redirect_url: job.rows[0].application_url }
      });
    }

    // Check if deadline has passed
    if (job.rows[0].deadline && new Date() > new Date(job.rows[0].deadline)) {
      return res.status(400).json({
        success: false,
        message: 'Application deadline has passed'
      });
    }

    // Check if already applied
    const existingApplication = await db.query(`
      SELECT id FROM job_applications
      WHERE job_id = $1 AND student_id = $2
    `, [id, userId]);

    if (existingApplication.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Already applied for this job'
      });
    }

    // Apply for job
    await db.query(`
      INSERT INTO job_applications (job_id, student_id, cover_letter, resume_url)
      VALUES ($1, $2, $3, $4)
    `, [id, userId, cover_letter, resume_url]);

    res.json({
      success: true,
      message: 'Successfully applied for job'
    });

  } catch (error) {
    console.error('Apply for job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply for job'
    });
  }
};

// Get applied jobs
const getAppliedJobs = async (req, res) => {
  try {
    const userId = req.user.id;

    const appliedJobs = await db.query(`
      SELECT 
        ja.id as application_id,
        ja.application_date,
        ja.status,
        ja.cover_letter,
        ja.resume_url,
        j.id as job_id,
        j.title,
        j.company,
        j.location,
        j.job_type,
        j.salary_min,
        j.salary_max,
        j.deadline
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      WHERE ja.student_id = $1
      ORDER BY ja.application_date DESC
    `, [userId]);

    res.json({
      success: true,
      message: 'Applied jobs retrieved successfully',
      data: appliedJobs.rows
    });

  } catch (error) {
    console.error('Get applied jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve applied jobs'
    });
  }
};

// Get job types
const getJobTypes = async (req, res) => {
  try {
    const jobTypes = [
      { id: 'full-time', name: 'Full Time' },
      { id: 'part-time', name: 'Part Time' },
      { id: 'internship', name: 'Internship' },
      { id: 'remote', name: 'Remote' },
      { id: 'contract', name: 'Contract' }
    ];

    res.json({
      success: true,
      message: 'Job types retrieved successfully',
      data: jobTypes
    });

  } catch (error) {
    console.error('Get job types error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job types'
    });
  }
};

// Get job locations
const getJobLocations = async (req, res) => {
  try {
    let locations;
    try {
      locations = await db.query(`
        SELECT DISTINCT location
        FROM jobs
        WHERE location IS NOT NULL AND location != ''
        ORDER BY location
      `);
    } catch (error) {
      // Fallback for environments missing jobs table
      console.error('Get job locations error (using fallback):', error);
      return res.json({
        success: true,
        message: 'Job locations retrieved successfully',
        data: []
      });
    }

    res.json({
      success: true,
      message: 'Job locations retrieved successfully',
      data: locations.rows.map(row => row.location)
    });

  } catch (error) {
    console.error('Get job locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve job locations'
    });
  }
};

module.exports = {
  getJobs,
  getJobById,
  applyForJob,
  getAppliedJobs,
  getJobTypes,
  getJobLocations
};
