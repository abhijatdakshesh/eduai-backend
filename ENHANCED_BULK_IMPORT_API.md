# Enhanced Bulk Import/Export System API Documentation

## Overview
This document describes the enhanced bulk import/export system that supports student-parent linking with department, year, semester, and section management.

## Database Schema Updates

### New Tables Created
1. **parent_student_relationships** - Enhanced parent-student linking
2. **departments** - Department management
3. **academic_periods** - Academic year and semester management

### Enhanced Students Table
Added new columns:
- `department` (VARCHAR(100))
- `academic_year` (VARCHAR(20))
- `semester` (VARCHAR(50))
- `section` (VARCHAR(10))
- `address` (TEXT)
- `emergency_contact` (VARCHAR(255))
- `medical_info` (TEXT)

## API Endpoints

### 1. CSV Validation Endpoint
**POST** `/api/v1/admin/bulk-import/validate`

Validates a CSV file before import to check for errors and provide preview.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (CSV file)

**Response:**
```json
{
  "success": true,
  "data": {
    "valid_rows": 145,
    "invalid_rows": 5,
    "validation_errors": [
      {
        "row": 3,
        "errors": ["Invalid email format", "Missing department"],
        "data": {...}
      }
    ],
    "preview": {
      "students_to_create": 120,
      "parents_to_create": 80,
      "departments_to_create": 3
    }
  }
}
```

### 2. Enhanced Bulk Import Endpoint
**POST** `/api/v1/admin/bulk-import/unified`

Imports students with automatic parent creation and linking.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: `file` (CSV file)

**CSV Format:**
```csv
type,first_name,last_name,email,password,role,student_id,department,academic_year,semester,section,grade_level,class_name,room_id,teacher_email,parent_email,parent_phone,parent_relationship,phone,address,date_of_birth,gender,emergency_contact,medical_info,enrollment_date,status
student,John,Doe,john.doe@student.edu,password123,student,STU001,Computer Science,2024-2025,Fall 2024,A,Grade 10,CS101,ROOM-101,teacher@school.edu,parent@email.com,+1234567890,Father,+1234567890,123 Main St,2005-01-15,Male,John Parent +1234567890,None,2024-01-01,active
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imported": 150,
    "errors": 5,
    "details": {
      "students_created": 120,
      "parents_created": 80,
      "relationships_linked": 120,
      "departments_created": 3,
      "errors": [
        {
          "row": 5,
          "error": "Invalid department: 'Invalid Dept'",
          "data": {...}
        }
      ]
    }
  }
}
```

### 3. Students Export Endpoint
**GET** `/api/v1/admin/students/export`

Exports students with filtering options and parent information.

**Query Parameters:**
- `department` (optional): Filter by department
- `academic_year` (optional): Filter by academic year
- `semester` (optional): Filter by semester
- `section` (optional): Filter by section
- `include_parents` (optional): Include parent information (default: true)

**Response:**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "uuid",
        "student_id": "STU001",
        "department": "Computer Science",
        "academic_year": "2024-2025",
        "semester": "Fall 2024",
        "section": "A",
        "grade_level": "Grade 10",
        "enrollment_date": "2024-01-01",
        "address": "123 Main St",
        "emergency_contact": "John Parent +1234567890",
        "medical_info": "None",
        "status": "active",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@student.edu",
        "phone": "+1234567890",
        "date_of_birth": "2005-01-15",
        "gender": "Male",
        "parent_relationship": "Father",
        "parent_email": "parent@email.com",
        "parent_phone": "+1234567890"
      }
    ],
    "total_count": 150,
    "exported_at": "2024-01-15T10:30:00Z"
  }
}
```

### 4. Department Management

#### Get Departments
**GET** `/api/v1/admin/departments`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `search` (optional): Search by name or code

#### Create Department
**POST** `/api/v1/admin/departments`

**Request Body:**
```json
{
  "name": "Computer Science",
  "code": "CS",
  "description": "Computer Science Department"
}
```

### 5. Academic Period Management

#### Get Academic Periods
**GET** `/api/v1/admin/academic-periods`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `is_active` (optional): Filter by active status

#### Create Academic Period
**POST** `/api/v1/admin/academic-periods`

**Request Body:**
```json
{
  "academic_year": "2024-2025",
  "semester": "Fall 2024",
  "start_date": "2024-08-01",
  "end_date": "2024-12-15",
  "is_active": true
}
```

## Business Logic Features

### 1. Automatic Parent Creation
- Creates parent user accounts if they don't exist
- Links parents to students automatically
- Supports multiple children per parent

### 2. Department Management
- Auto-creates departments if they don't exist
- Case-insensitive matching
- Validates department names

### 3. Academic Period Management
- Validates academic year format (YYYY-YYYY)
- Auto-creates academic periods
- Supports semester tracking

### 4. Enhanced Validation
- Email format validation
- Duplicate checking (email, student_id)
- Required field validation
- Data type validation

### 5. Error Handling
- Detailed error reporting with row numbers
- Transaction rollback on critical errors
- Partial import support for non-critical errors

## Performance Features

### 1. Batch Processing
- Processes large CSV files efficiently
- Database transactions for data integrity
- Memory-efficient streaming

### 2. Caching
- Department lookup caching
- Academic period caching
- User lookup caching

### 3. Indexing
- Database indexes for performance
- Optimized queries for large datasets

## Security Features

### 1. File Validation
- CSV file type validation
- File size limits
- Content sanitization

### 2. Data Validation
- SQL injection prevention
- XSS prevention
- Input sanitization

### 3. Access Control
- Admin-only access
- Audit logging
- Rate limiting ready

## Sample CSV File

A sample CSV file is provided at `sample_data/sample_bulk_import.csv` with the following structure:

```csv
type,first_name,last_name,email,password,role,student_id,department,academic_year,semester,section,grade_level,class_name,room_id,teacher_email,parent_email,parent_phone,parent_relationship,phone,address,date_of_birth,gender,emergency_contact,medical_info,enrollment_date,status
student,John,Doe,john.doe@student.edu,password123,student,STU001,Computer Science,2024-2025,Fall 2024,A,Grade 10,CS101,ROOM-101,teacher@school.edu,parent@email.com,+1234567890,Father,+1234567890,123 Main St,2005-01-15,Male,John Parent +1234567890,None,2024-01-01,active
```

## Usage Examples

### 1. Validate CSV Before Import
```bash
curl -X POST http://localhost:3001/api/v1/admin/bulk-import/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample_bulk_import.csv"
```

### 2. Import Students
```bash
curl -X POST http://localhost:3001/api/v1/admin/bulk-import/unified \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample_bulk_import.csv"
```

### 3. Export Students
```bash
curl -X GET "http://localhost:3001/api/v1/admin/students/export?department=Computer Science&academic_year=2024-2025" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Get Departments
```bash
curl -X GET http://localhost:3001/api/v1/admin/departments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Error Codes

- `400`: Bad Request - Invalid CSV format or missing required fields
- `401`: Unauthorized - Invalid or missing JWT token
- `403`: Forbidden - User doesn't have admin privileges
- `500`: Internal Server Error - Database or server error

## Migration

To set up the enhanced bulk import system, run:

```bash
node scripts/migrate_enhanced_bulk_import.js
```

This will:
1. Add new columns to the students table
2. Create new tables (parent_student_relationships, departments, academic_periods)
3. Insert default departments and academic periods
4. Create performance indexes

## Testing

Test the system with the provided sample CSV file:

```bash
# 1. Validate the CSV
curl -X POST http://localhost:3001/api/v1/admin/bulk-import/validate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample_data/sample_bulk_import.csv"

# 2. Import the data
curl -X POST http://localhost:3001/api/v1/admin/bulk-import/unified \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@sample_data/sample_bulk_import.csv"

# 3. Export the data
curl -X GET http://localhost:3001/api/v1/admin/students/export \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Frontend Integration

The frontend can now:
1. Upload CSV files for validation and import
2. Export student data with filtering
3. Manage departments and academic periods
4. View detailed import/export results
5. Handle parent-student relationships automatically

This system provides a complete solution for bulk student management with proper academic organization and parent linking.
