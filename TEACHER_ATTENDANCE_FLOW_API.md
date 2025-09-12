# Teacher Attendance Flow API Documentation

## Overview

The Teacher Attendance Flow API provides a new way for teachers to mark attendance based on department, section, and time slot rather than traditional class-based attendance. This system allows for more flexible attendance tracking across different departments and sections.

## Database Schema

### New Tables

#### `teacher_attendance`
Stores the main attendance records with department/section/time context.

```sql
CREATE TABLE teacher_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  section VARCHAR(10) NOT NULL,
  time_slot TIME NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(teacher_id, department_id, section, time_slot, date)
);
```

#### `student_attendance_entries`
Stores individual student attendance records linked to the main attendance record.

```sql
CREATE TABLE student_attendance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES teacher_attendance(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attendance_id, student_id)
);
```

### Constraints

- **Section values**: Must be one of 'A', 'B', 'C', 'D'
- **Time slot**: Must be between 09:00:00 and 17:00:00
- **Status values**: Must be one of 'present', 'absent', 'late', 'excused'

## API Endpoints

All endpoints require teacher authentication and are prefixed with `/api/v1/teacher/`.

### 1. Get Departments

**GET** `/departments`

Returns all available departments that teachers can use for attendance marking.

**Response:**
```json
{
  "success": true,
  "message": "Departments retrieved successfully",
  "data": {
    "departments": [
      {
        "id": "uuid",
        "name": "Computer Science",
        "code": "CS",
        "description": "Department of Computer Science and Engineering"
      }
    ]
  }
}
```

### 2. Get Sections by Department

**GET** `/departments/:departmentId/sections`

Returns available sections for a specific department.

**Parameters:**
- `departmentId` (path): UUID of the department

**Response:**
```json
{
  "success": true,
  "message": "Sections retrieved successfully",
  "data": {
    "department": {
      "id": "uuid",
      "name": "Computer Science"
    },
    "sections": ["A", "B", "C", "D"]
  }
}
```

### 3. Get Students by Department/Section/Time

**GET** `/attendance/students`

Returns students enrolled in a specific department and section.

**Query Parameters:**
- `departmentId` (required): UUID of the department
- `section` (required): Section name (A, B, C, or D)
- `timeSlot` (required): Time slot in HH:MM:SS format
- `date` (required): Date in YYYY-MM-DD format

**Example:**
```
GET /attendance/students?departmentId=uuid&section=A&timeSlot=09:00:00&date=2024-01-15
```

**Response:**
```json
{
  "success": true,
  "message": "Students retrieved successfully",
  "data": {
    "students": [
      {
        "student_id": "uuid",
        "student_code": "S001",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@student.edu"
      }
    ]
  }
}
```

### 4. Save Attendance

**POST** `/attendance/mark`

Saves attendance records for students in a specific department/section/time slot.

**Request Body:**
```json
{
  "departmentId": "uuid",
  "section": "A",
  "timeSlot": "09:00:00",
  "date": "2024-01-15",
  "entries": [
    {
      "student_id": "uuid",
      "status": "present",
      "notes": "Optional notes"
    },
    {
      "student_id": "uuid",
      "status": "absent",
      "notes": "Sick leave"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Attendance saved successfully",
  "data": {
    "attendanceId": "uuid",
    "savedCount": 2,
    "departmentId": "uuid",
    "section": "A",
    "timeSlot": "09:00:00",
    "date": "2024-01-15"
  }
}
```

### 5. Get Existing Attendance Records

**GET** `/attendance/records`

Retrieves existing attendance records for a specific department/section/time slot.

**Query Parameters:**
- `departmentId` (required): UUID of the department
- `section` (required): Section name (A, B, C, or D)
- `timeSlot` (required): Time slot in HH:MM:SS format
- `date` (required): Date in YYYY-MM-DD format

**Response:**
```json
{
  "success": true,
  "message": "Attendance record retrieved successfully",
  "data": {
    "attendance": {
      "attendance_id": "uuid",
      "teacher_id": "uuid",
      "department_id": "uuid",
      "section": "A",
      "time_slot": "09:00:00",
      "date": "2024-01-15",
      "created_at": "2024-01-15T09:00:00Z",
      "updated_at": "2024-01-15T09:00:00Z"
    },
    "entries": [
      {
        "id": "uuid",
        "student_id": "uuid",
        "status": "present",
        "notes": null,
        "created_at": "2024-01-15T09:00:00Z",
        "student_code": "S001",
        "first_name": "John",
        "last_name": "Doe"
      }
    ]
  }
}
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "data": {
    "error_code": "SPECIFIC_ERROR_CODE"
  }
}
```

### Common Error Codes

- `400`: Bad Request - Missing or invalid parameters
- `401`: Unauthorized - Invalid or missing authentication token
- `403`: Forbidden - User not authorized for this action
- `404`: Not Found - Resource not found
- `500`: Internal Server Error - Server-side error

## Usage Flow

1. **Get Departments**: Call `/departments` to get available departments
2. **Get Sections**: Call `/departments/:departmentId/sections` to get sections for selected department
3. **Get Students**: Call `/attendance/students` with department, section, time, and date to get student list
4. **Mark Attendance**: Call `/attendance/mark` to save attendance records
5. **Retrieve Records**: Call `/attendance/records` to get existing attendance for editing

## Authentication

All endpoints require:
- Valid JWT token in Authorization header: `Bearer <token>`
- User must have `teacher` role
- Token must be active and not expired

## Data Validation

### Time Slots
- Must be in HH:MM:SS format
- Must be between 09:00:00 and 17:00:00
- Common slots: 09:00:00, 10:00:00, 11:00:00, etc.

### Sections
- Must be one of: A, B, C, D
- Case sensitive

### Status Values
- `present`: Student is present
- `absent`: Student is absent
- `late`: Student arrived late
- `excused`: Student has valid excuse

### Dates
- Must be in YYYY-MM-DD format
- Cannot be in the future (validation may be added)

## Database Indexes

The following indexes are created for optimal performance:

- `idx_teacher_attendance_teacher`: On (teacher_id, date DESC)
- `idx_teacher_attendance_department`: On (department_id, section, date)
- `idx_teacher_attendance_time`: On (time_slot, date)
- `idx_student_attendance_entries_attendance`: On (attendance_id)
- `idx_student_attendance_entries_student`: On (student_id, created_at DESC)

## Audit Logging

All attendance operations are logged in the `audit_logs` table with:
- User ID
- Action type: `save_department_section_attendance`
- Resource type: `teacher_attendance`
- Resource ID: attendance record ID
- Details: JSON with operation metadata

## Migration Scripts

### Setup
```bash
# Create new tables
node scripts/migrate_teacher_attendance.js

# Seed sample data
node scripts/seed_teacher_attendance_data.js

# Test the implementation
node scripts/test_teacher_attendance_flow.js
```

## Sample Data

The system includes sample data for testing:
- 11 departments (Computer Science, Information Science, etc.)
- 4 sections per department (A, B, C, D)
- 8 sample students distributed across sections
- 3 sample teachers

## Frontend Integration

This API is designed to work with the frontend TeacherAttendanceFlowScreen that provides:
1. Department selection dropdown
2. Section selection based on department
3. Time slot picker (1-hour intervals)
4. Student list display
5. Attendance marking interface
6. Save/update functionality

The frontend should handle the step-by-step flow and call the appropriate API endpoints at each stage.
