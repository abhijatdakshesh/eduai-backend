const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const coursesRoutes = require('./routes/courses');
const scheduleRoutes = require('./routes/schedule');
const jobsRoutes = require('./routes/jobs');
const financeRoutes = require('./routes/finance');
const resultsRoutes = require('./routes/results');
const servicesRoutes = require('./routes/services');
const aiRoutes = require('./routes/ai');
const staffRoutes = require('./routes/staff');
const teacherRoutes = require('./routes/teacher');
const parentRoutes = require('./routes/parent');
const attendanceRoutes = require('./routes/attendance');
const studentRoutes = require('./routes/student');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8081', 'http://192.168.1.139:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Device-Id', 'X-Platform', 'X-OS-Version', 'X-Country', 'X-State', 'X-City', 'X-Timezone']
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    data: {
      retry_after: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      data: {
        retry_after: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
      }
    });
  }
});

app.use(limiter);

// Store rate limit info in request for logging
app.use((req, res, next) => {
  req.rateLimit = {
    remaining: res.getHeader('X-RateLimit-Remaining'),
    limit: res.getHeader('X-RateLimit-Limit'),
    reset: res.getHeader('X-RateLimit-Reset')
  };
  next();
});

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// API versioning
const API_VERSION = 'v1';
const BASE_PATH = `/api/${API_VERSION}`;

// Route registry for consolidated mounting
const routeRegistry = [
  { path: `${BASE_PATH}/auth`, router: authRoutes },
  { path: `${BASE_PATH}/admin`, router: adminRoutes },
  { path: `${BASE_PATH}/dashboard`, router: dashboardRoutes },
  { path: `${BASE_PATH}/courses`, router: coursesRoutes },
  { path: `${BASE_PATH}/schedule`, router: scheduleRoutes },
  { path: `${BASE_PATH}/jobs`, router: jobsRoutes },
  { path: `${BASE_PATH}/finance`, router: financeRoutes },
  { path: `${BASE_PATH}/results`, router: resultsRoutes },
  { path: `${BASE_PATH}/services`, router: servicesRoutes },
  { path: `${BASE_PATH}/ai`, router: aiRoutes },
  { path: `${BASE_PATH}/staff`, router: staffRoutes },
  { path: `${BASE_PATH}/teacher`, router: teacherRoutes },
  { path: `${BASE_PATH}/parent`, router: parentRoutes },
  { path: `${BASE_PATH}/attendance`, router: attendanceRoutes },
  { path: `${BASE_PATH}/student`, router: studentRoutes },
  { path: '/health', router: healthRoutes }
];

// Mount all routes
routeRegistry.forEach(({ path, router }) => app.use(path, router));

// Build endpoint map for responses
const endpointMap = routeRegistry.reduce((acc, { path }) => {
  const key = path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length + 1) : 'health';
  acc[key] = path;
  return acc;
}, {});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'EduAI Authentication API',
    data: {
      version: '1.0.0',
      api_version: API_VERSION,
      base_url: `${req.protocol}://${req.get('host')}${BASE_PATH}`,
      endpoints: endpointMap,
      documentation: 'API documentation available at /docs (if implemented)'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    data: {
      requested_url: req.originalUrl,
      method: req.method,
      available_endpoints: endpointMap
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      data: {
        errors: error.errors
      }
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    data: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      name: error.name
    } : undefined
  });
});

// Graceful shutdown
app.on ? null : null; // no-op to avoid unused warnings if any
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 EduAI Authentication API server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔐 API endpoints available at: http://localhost:${PORT}${BASE_PATH}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 