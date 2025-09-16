const db = require('../config/database');
const bcrypt = require('bcrypt');

class BulkImportService {
  constructor() {
    this.departmentCache = new Map();
    this.academicPeriodCache = new Map();
    this.userCache = new Map();
  }

  // Parse CSV buffer into array of objects
  async parseCSV(buffer) {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;
      
      const row = {};
      headers.forEach((header, index) => {
        row[header] = (values[index] || '').trim().replace(/"/g, '');
      });
      rows.push(row);
    }
    
    return rows;
  }

  // Parse a single CSV line handling quoted values
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current);
    return values;
  }

  // Validate CSV data
  async validateCSVData(csvData) {
    const errors = [];
    const validRows = [];
    const preview = {
      students_to_create: 0,
      parents_to_create: 0,
      departments_to_create: 0
    };

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const rowErrors = [];
      const rowNumber = i + 2; // +2 because we start from row 2 (after header)

      // Validate required fields for students
      if (row.type === 'student') {
        if (!row.first_name) rowErrors.push('Missing first_name');
        if (!row.last_name) rowErrors.push('Missing last_name');
        if (!row.email) rowErrors.push('Missing email');
        if (!row.student_id) rowErrors.push('Missing student_id');
        if (!row.department) rowErrors.push('Missing department');

        // Validate email format
        if (row.email && !this.isValidEmail(row.email)) {
          rowErrors.push('Invalid email format');
        }

        // Check for duplicate student_id
        if (row.student_id) {
          const existing = await db.query('SELECT id FROM students WHERE student_id = $1', [row.student_id]);
          if (existing.rows.length > 0) {
            rowErrors.push('Student ID already exists');
          }
        }

        // Check for duplicate email
        if (row.email) {
          const existing = await db.query('SELECT id FROM users WHERE email = $1', [row.email]);
          if (existing.rows.length > 0) {
            rowErrors.push('Email already exists');
          }
        }

        if (rowErrors.length === 0) {
          validRows.push(row);
          preview.students_to_create++;
        }
      }

      // Validate parent data
      if (row.parent_email) {
        const existingParent = await db.query('SELECT id FROM users WHERE email = $1', [row.parent_email]);
        if (existingParent.rows.length === 0) {
          preview.parents_to_create++;
        }
      }

      // Check for new departments
      if (row.department) {
        const existingDept = await this.getDepartmentByName(row.department);
        if (!existingDept) {
          preview.departments_to_create++;
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: rowErrors,
          data: row
        });
      }
    }

    return {
      valid_rows: validRows.length,
      invalid_rows: errors.length,
      validation_errors: errors,
      preview
    };
  }

  // Process unified CSV import
  async processUnifiedCSV(file) {
    const csvData = await this.parseCSV(file.buffer);
    
    if (csvData.length === 0) {
      throw new Error('CSV file is empty');
    }

    const results = {
      imported: 0,
      errors: 0,
      details: {
        students_created: 0,
        parents_created: 0,
        relationships_linked: 0,
        departments_created: 0,
        errors: []
      }
    };

    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      for (let i = 0; i < csvData.length; i++) {
        try {
          const row = csvData[i];
          
          if (row.type === 'student') {
            await this.processStudentRow(row, results, client);
          }
          
          results.imported++;
        } catch (error) {
          results.errors++;
          results.details.errors.push({
            row: i + 2,
            error: error.message,
            data: csvData[i]
          });
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return results;
  }

  // Process a single student row
  async processStudentRow(row, results, client) {
    // 1. Create or get department
    const department = await this.createOrGetDepartment(row.department, client);
    if (!department) {
      results.details.departments_created++;
    }

    // 2. Create or get academic period
    if (row.academic_year && row.semester) {
      await this.createOrGetAcademicPeriod(row.academic_year, row.semester, client);
    }

    // 3. Create user account
    const passwordHash = await bcrypt.hash(row.password || 'password123', 10);
    const userResult = await client.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone, date_of_birth, gender, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      row.email,
      passwordHash,
      row.first_name,
      row.last_name,
      'student',
      row.phone || null,
      row.date_of_birth || null,
      row.gender || null,
      row.address || null
    ]);

    const userId = userResult.rows[0].id;

    // 4. Create student profile
    const studentResult = await client.query(`
      INSERT INTO students (
        user_id, student_id, department, academic_year, semester, section,
        grade_level, enrollment_date, address, emergency_contact, medical_info, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      userId,
      row.student_id,
      row.department,
      row.academic_year || null,
      row.semester || null,
      row.section || null,
      row.grade_level || null,
      row.enrollment_date || new Date().toISOString().split('T')[0],
      row.address || null,
      row.emergency_contact || null,
      row.medical_info || null,
      row.status || 'active'
    ]);

    const studentId = studentResult.rows[0].id;
    results.details.students_created++;

    // 5. Handle parent creation and linking
    if (row.parent_email) {
      await this.createOrLinkParent(row, studentId, results, client);
    }
  }

  // Create or link parent to student
  async createOrLinkParent(row, studentId, results, client) {
    // Check if parent exists
    let parentUser = await client.query('SELECT id FROM users WHERE email = $1', [row.parent_email]);
    
    if (parentUser.rows.length === 0) {
      // Create parent user
      const passwordHash = await bcrypt.hash('password123', 10);
      const parentUserResult = await client.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, user_type, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        row.parent_email,
        passwordHash,
        row.parent_first_name || 'Parent',
        row.parent_last_name || 'User',
        'parent',
        row.parent_phone || null
      ]);

      parentUser = parentUserResult;
      results.details.parents_created++;
    }

    const parentUserId = parentUser.rows[0].id;

    // Create parent profile if it doesn't exist
    const existingParent = await client.query('SELECT id FROM parents WHERE user_id = $1', [parentUserId]);
    if (existingParent.rows.length === 0) {
      await client.query(`
        INSERT INTO parents (user_id, parent_id, primary_phone, address_line1, city, state, postal_code, country)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        parentUserId,
        `PARENT_${parentUserId.substring(0, 8)}`,
        row.parent_phone || null,
        row.parent_address || null,
        row.parent_city || null,
        row.parent_state || null,
        row.parent_postal_code || null,
        row.parent_country || null
      ]);
    }

    // Create parent-student relationship
    await client.query(`
      INSERT INTO parent_student_relationships (parent_id, student_id, relationship)
      VALUES ($1, $2, $3)
      ON CONFLICT (parent_id, student_id) DO NOTHING
    `, [parentUserId, studentId, row.parent_relationship || 'Parent']);

    results.details.relationships_linked++;
  }

  // Create or get department
  async createOrGetDepartment(departmentName, client) {
    if (this.departmentCache.has(departmentName)) {
      return this.departmentCache.get(departmentName);
    }

    let department = await client.query('SELECT id FROM departments WHERE name = $1', [departmentName]);
    
    if (department.rows.length === 0) {
      const newDept = await client.query(`
        INSERT INTO departments (name, code)
        VALUES ($1, $2)
        RETURNING id
      `, [departmentName, departmentName.substring(0, 3).toUpperCase()]);
      
      department = newDept;
    }

    this.departmentCache.set(departmentName, department.rows[0]);
    return department.rows[0];
  }

  // Create or get academic period
  async createOrGetAcademicPeriod(academicYear, semester, client) {
    const key = `${academicYear}-${semester}`;
    
    if (this.academicPeriodCache.has(key)) {
      return this.academicPeriodCache.get(key);
    }

    let period = await client.query(
      'SELECT id FROM academic_periods WHERE academic_year = $1 AND semester = $2',
      [academicYear, semester]
    );
    
    if (period.rows.length === 0) {
      const newPeriod = await client.query(`
        INSERT INTO academic_periods (academic_year, semester, is_active)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [academicYear, semester, false]);
      
      period = newPeriod;
    }

    this.academicPeriodCache.set(key, period.rows[0]);
    return period.rows[0];
  }

  // Get department by name
  async getDepartmentByName(name) {
    if (this.departmentCache.has(name)) {
      return this.departmentCache.get(name);
    }

    const result = await db.query('SELECT id FROM departments WHERE name = $1', [name]);
    if (result.rows.length > 0) {
      this.departmentCache.set(name, result.rows[0]);
      return result.rows[0];
    }
    
    return null;
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Export students with filtering
  async exportStudents(filters = {}) {
    let whereConditions = ['s.status = $1'];
    let queryParams = ['active'];
    let paramCount = 1;

    if (filters.department) {
      paramCount++;
      whereConditions.push(`s.department = $${paramCount}`);
      queryParams.push(filters.department);
    }

    if (filters.academic_year) {
      paramCount++;
      whereConditions.push(`s.academic_year = $${paramCount}`);
      queryParams.push(filters.academic_year);
    }

    if (filters.semester) {
      paramCount++;
      whereConditions.push(`s.semester = $${paramCount}`);
      queryParams.push(filters.semester);
    }

    if (filters.section) {
      paramCount++;
      whereConditions.push(`s.section = $${paramCount}`);
      queryParams.push(filters.section);
    }

    const query = `
      SELECT 
        s.id, s.student_id, s.department, s.academic_year, s.semester, s.section,
        s.grade_level, s.enrollment_date, s.address, s.emergency_contact, s.medical_info, s.status,
        u.first_name, u.last_name, u.email, u.phone, u.date_of_birth, u.gender,
        psr.relationship as parent_relationship,
        pu.email as parent_email, pu.phone as parent_phone
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN parent_student_relationships psr ON s.id = psr.student_id
      LEFT JOIN users pu ON psr.parent_id = pu.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY s.created_at DESC
    `;

    const result = await db.query(query, queryParams);
    
    return {
      students: result.rows,
      total_count: result.rows.length,
      exported_at: new Date().toISOString()
    };
  }
}

module.exports = new BulkImportService();
