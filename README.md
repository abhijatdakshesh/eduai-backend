# EduAI Authentication API

A comprehensive authentication system for EduAI built with Node.js, Express, and PostgreSQL. This API provides complete user authentication, session management, email verification, and password reset functionality.

## Features

- 🔐 **User Registration & Login** - Secure user authentication with password hashing
- 📧 **Email Verification** - Email-based account verification system
- 🔄 **Password Management** - Forgot password and reset functionality
- 📱 **Session Management** - Multi-device session tracking and management
- 🛡️ **Security Features** - JWT tokens, rate limiting, CORS, and input validation
- 📊 **Audit Logging** - Comprehensive activity tracking
- 🏥 **Health Monitoring** - API health check endpoints
- 📈 **Performance** - Request/response compression and optimization

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Email**: Nodemailer
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Morgan

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd eduai-auth-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=development

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=eduai_auth
   DB_USER=postgres
   DB_PASSWORD=your_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=7d

   # Email Configuration
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   EMAIL_FROM=noreply@eduai.com
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database
   createdb eduai_auth
   
   # Run migrations
   npm run migrate
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Base URL
```
http://localhost:3001/api/v1
```

### Authentication Endpoints

#### 1. User Registration
```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "student@eduai.com",
  "password": "StudentPass123!",
  "confirm_password": "StudentPass123!",
  "first_name": "John",
  "last_name": "Doe",
  "user_type": "student",
  "phone": "+1234567890",
  "date_of_birth": "2000-01-01",
  "gender": "male",
  "terms_accepted": true,
  "privacy_policy_accepted": true,
  "marketing_consent": false,
  "device_info": {
    "device_id": "device_123",
    "device_type": "web",
    "os_version": "macOS",
    "app_version": "1.0.0"
  },
  "location_info": {
    "country": "US",
    "state": "CA",
    "city": "San Francisco",
    "timezone": "America/Los_Angeles"
  }
}
```

#### 2. User Login
```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "student@eduai.com",
  "password": "StudentPass123!",
  "device_info": {
    "device_id": "device_123",
    "device_type": "web",
    "os_version": "macOS",
    "app_version": "1.0.0"
  },
  "location_info": {
    "country": "US",
    "state": "CA",
    "city": "San Francisco",
    "timezone": "America/Los_Angeles"
  }
}
```

#### 3. Email Verification
```http
POST /auth/verify-email
```

**Request Body:**
```json
{
  "verification_token": "your_verification_token"
}
```

#### 4. Resend Verification Email
```http
POST /auth/resend-verification
```

**Request Body:**
```json
{
  "email": "student@eduai.com"
}
```

#### 5. Forgot Password
```http
POST /auth/forgot-password
```

**Request Body:**
```json
{
  "email": "student@eduai.com"
}
```

#### 6. Reset Password
```http
POST /auth/reset-password
```

**Request Body:**
```json
{
  "reset_token": "your_reset_token",
  "new_password": "NewPassword123!",
  "confirm_password": "NewPassword123!"
}
```

#### 7. Get User Sessions
```http
GET /auth/sessions
```

**Headers:**
```
Authorization: Bearer <access_token>
```

#### 8. Refresh Token
```http
POST /auth/refresh
```

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Request Body:**
```json
{
  "device_id": "device_123"
}
```

#### 9. Get User Profile
```http
GET /auth/profile
```

**Headers:**
```
Authorization: Bearer <access_token>
```

#### 10. Logout
```http
POST /auth/logout
```

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "device_id": "device_123",
  "logout_all_sessions": false
}
```

### Health Check

#### 11. Server Health
```http
GET /health
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "metadata": {
    "request_id": "uuid",
    "processing_time_ms": 150,
    "rate_limit_remaining": 99
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "data": {
    "errors": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

## Headers

### Required Headers
- `Content-Type: application/json`
- `X-Client-Version: 1.0.0`
- `X-Device-Id: device_123`
- `X-Platform: web`

### Optional Headers
- `X-OS-Version: macOS`
- `X-Country: US`
- `X-State: CA`
- `X-City: San Francisco`
- `X-Timezone: America/Los_Angeles`

### Authentication Headers
- `Authorization: Bearer <access_token>` (for protected routes)

## Database Schema

### Tables
1. **users** - User accounts and basic information
2. **verification_tokens** - Email verification and password reset tokens
3. **user_sessions** - Active user sessions across devices
4. **user_profiles** - Extended user profile information
5. **audit_logs** - Activity tracking and security logs

## Security Features

- **Password Hashing**: bcryptjs with configurable salt rounds
- **JWT Tokens**: Secure access and refresh tokens
- **Rate Limiting**: Configurable request rate limiting
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers and protection
- **Audit Logging**: Complete activity tracking

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment mode | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `DB_NAME` | Database name | eduai_auth |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | 15m |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | 7d |
| `EMAIL_HOST` | SMTP host | smtp.gmail.com |
| `EMAIL_PORT` | SMTP port | 587 |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASS` | SMTP password | - |
| `EMAIL_FROM` | From email address | noreply@eduai.com |

## Scripts

```bash
# Start development server
npm run dev

# Start production server
npm start

# Run database migrations
npm run migrate

# Run tests
npm test
```

## Testing with Postman

1. Import the provided Postman collection
2. Set up environment variables in Postman:
   - `base_url`: `http://localhost:3001/api/v1`
   - `user_email`: Your test email
   - `student_password`: Your test password
   - `device_id`: Auto-generated device ID

3. Run the collection tests in sequence

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: Validation errors, invalid input
- **401 Unauthorized**: Invalid or missing authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource already exists
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please contact the development team or create an issue in the repository. 