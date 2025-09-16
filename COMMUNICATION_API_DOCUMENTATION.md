# Communication API Documentation

## Overview
This document describes the WhatsApp and AI Call communication system for parent notifications regarding student attendance.

## Database Schema

### Communications Table
```sql
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(50) NOT NULL,
    parent_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('whatsapp', 'ai_call')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'scheduled', 'completed', 'cancelled')),
    message TEXT,
    call_script TEXT,
    attendance_status VARCHAR(20),
    attendance_date DATE,
    attendance_notes TEXT,
    sent_at TIMESTAMP,
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration INTEGER, -- for calls, in seconds
    external_id VARCHAR(100), -- WhatsApp message ID or call ID
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## API Endpoints

### 1. Get Student Parents
**GET** `/api/v1/student/{studentId}/parents`

Get parent information for a specific student.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "uuid",
      "student_id": "STU001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@student.edu"
    },
    "parents": [
      {
        "id": "uuid",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "parent@example.com",
        "phone": "+1234567890",
        "relationship": "Mother",
        "is_primary": true,
        "address": {
          "line1": "123 Main St",
          "city": "City",
          "state": "State",
          "postal_code": "12345",
          "country": "Country"
        }
      }
    ]
  }
}
```

### 2. Send WhatsApp Message
**POST** `/api/v1/communications/whatsapp/send`

Send a WhatsApp message to a parent.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "student_id": "STU001",
  "parent_id": "uuid",
  "message": "Dear Parent/Guardian,\n\nYour ward John Smith was marked as ABSENT on 2024-01-15.\n\nReason: Sick\n\nPlease ensure regular attendance for better academic performance.\n\nBest regards,\nTeacher",
  "attendance_status": "absent",
  "date": "2024-01-15",
  "notes": "Sick"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_123456",
    "status": "sent",
    "sent_at": "2024-01-15T10:30:00Z",
    "communication_id": "uuid"
  }
}
```

### 3. Schedule AI Call
**POST** `/api/v1/communications/ai-call/schedule`

Schedule an AI call to a parent.

**Headers:**
- `Authorization: Bearer <jwt_token>`
- `Content-Type: application/json`

**Request Body:**
```json
{
  "student_id": "STU001",
  "parent_id": "uuid",
  "call_script": "Hello John Smith, this is an automated call from the school regarding your ward's attendance...",
  "attendance_status": "absent",
  "date": "2024-01-15",
  "notes": "Sick",
  "scheduled_time": "2024-01-15T14:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "call_id": "call_789012",
    "status": "scheduled",
    "scheduled_at": "2024-01-15T14:00:00Z",
    "estimated_duration": "2-3 minutes",
    "communication_id": "uuid"
  }
}
```

### 4. Get Communication History
**GET** `/api/v1/communications/students/{studentId}/history`

Get communication history for a student.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Query Parameters:**
- `type` (optional): Filter by type (`whatsapp` or `ai_call`)
- `status` (optional): Filter by status
- `limit` (optional): Number of records to return (default: 50)
- `offset` (optional): Number of records to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": {
    "communications": [
      {
        "id": "uuid",
        "type": "whatsapp",
        "status": "sent",
        "message": "Your ward was marked as absent...",
        "attendance_status": "absent",
        "attendance_date": "2024-01-15",
        "sent_at": "2024-01-15T10:30:00Z",
        "parent_first_name": "Jane",
        "parent_last_name": "Smith",
        "parent_email": "parent@example.com",
        "parent_phone": "+1234567890"
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

### 5. Get Communication Statistics
**GET** `/api/v1/communications/students/{studentId}/stats`

Get communication statistics for a student.

**Headers:**
- `Authorization: Bearer <jwt_token>`

**Query Parameters:**
- `days` (optional): Number of days to look back (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "period_days": 30,
    "stats": {
      "whatsapp": {
        "sent": 5,
        "failed": 1,
        "delivered": 4
      },
      "ai_call": {
        "scheduled": 3,
        "completed": 2,
        "failed": 1,
        "cancelled": 0
      }
    }
  }
}
```

### 6. Update Communication Status
**PUT** `/api/v1/communications/{communicationId}/status`

Update communication status (for webhooks).

**Request Body:**
```json
{
  "status": "delivered",
  "external_id": "msg_123456",
  "completed_at": "2024-01-15T10:32:00Z",
  "duration": 120,
  "error_message": null
}
```

## Environment Variables

Add these to your `.env` file:

```env
# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

# AI Call Service
AI_CALL_API_KEY=your_ai_call_api_key
AI_CALL_SERVICE_URL=https://api.yourai-service.com
AI_CALL_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

## Frontend Integration

### API Client Methods

Add these methods to your frontend API client:

```javascript
class ApiClient {
  // Get parent information for a student
  async getStudentParents(studentId) {
    const response = await fetch(`${this.baseURL}/api/v1/student/${studentId}/parents`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  // Send WhatsApp message
  async sendWhatsAppMessage(data) {
    const response = await fetch(`${this.baseURL}/api/v1/communications/whatsapp/send`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Schedule AI call
  async scheduleAICall(data) {
    const response = await fetch(`${this.baseURL}/api/v1/communications/ai-call/schedule`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }

  // Get communication history
  async getCommunicationHistory(studentId, filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseURL}/api/v1/communications/students/${studentId}/history?${params}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  // Get communication statistics
  async getCommunicationStats(studentId, days = 30) {
    const response = await fetch(`${this.baseURL}/api/v1/communications/students/${studentId}/stats?days=${days}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }
}
```

### Frontend Modal Integration

Update your `ParentNotificationModal.js`:

```javascript
useEffect(() => {
  if (visible && student) {
    const fetchParentInfo = async () => {
      try {
        const response = await apiClient.getStudentParents(student.id);
        if (response.success && response.data.parents.length > 0) {
          setParentInfo(response.data.parents[0]); // Use primary parent
        }
      } catch (error) {
        console.error('Error fetching parent info:', error);
        // Fallback to default parent info
        setParentInfo({
          name: 'Parent/Guardian',
          phone: '+1234567890',
          relationship: 'Parent',
          email: 'parent@example.com',
        });
      }
    };
    
    fetchParentInfo();
  }
}, [visible, student]);
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing required fields)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (student/parent not found)
- `500`: Internal Server Error

## Security

- All endpoints require authentication
- Admin and teacher roles can send communications
- Parent role can view communication history for their children
- Rate limiting applies to all endpoints
- Input validation and sanitization implemented

## Testing

Test the endpoints using curl:

```bash
# Get student parents
curl -X GET "http://localhost:3001/api/v1/student/STU001/parents" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Send WhatsApp message
curl -X POST "http://localhost:3001/api/v1/communications/whatsapp/send" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "STU001",
    "parent_id": "parent-uuid",
    "message": "Test message",
    "attendance_status": "absent",
    "date": "2024-01-15"
  }'

# Schedule AI call
curl -X POST "http://localhost:3001/api/v1/communications/ai-call/schedule" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "STU001",
    "parent_id": "parent-uuid",
    "call_script": "Test call script",
    "attendance_status": "absent",
    "date": "2024-01-15"
  }'
```

## Migration

Run the communication table migration:

```bash
node scripts/migrate_communications.js
```

This will create the `communications` table with all necessary indexes and constraints.
