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
const classesRoutes = require('./routes/classes');
const assignmentRoutes = require('./routes/assignments');
const assessmentsRoutes = require('./routes/assessments');
const announcementsRoutes = require('./routes/announcements');
const sectionsRoutes = require('./routes/sections');
const errorHandler = require('./middleware/errorHandler');
const { authenticateToken } = require('./middleware/auth');
const { authenticateAssignmentFile, authenticateSubmissionFile, serveFile } = require('./middleware/fileAuth');

const app = express();
const PORT = process.env.PORT || 3001;
let serverInstance = null;
let io = null;

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version', 'X-Device-Id', 'X-Platform', 'X-OS-Version', 'X-Country', 'X-State', 'X-City', 'X-Timezone', 'Idempotency-Key', 'idempotency-key']
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
  { path: `${BASE_PATH}/classes`, router: classesRoutes },
  { path: `${BASE_PATH}/assignments`, router: assignmentRoutes },
  { path: `${BASE_PATH}/assessments`, router: assessmentsRoutes },
  { path: `${BASE_PATH}/announcements`, router: announcementsRoutes },
  { path: `${BASE_PATH}/sections`, router: sectionsRoutes },
  { path: '/health', router: healthRoutes }
];

// Mount all routes
routeRegistry.forEach(({ path, router }) => app.use(path, router));

// Secure file serving routes with authentication (replaces static serving)
// Support both Authorization header and token query parameter

// Add CORS headers for file access
app.use('/uploads', (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:8081', 'http://localhost:3000'];
  
  // Check if the origin is allowed
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    // Default to first allowed origin if origin not in list
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});
app.get('/uploads/assignments/:filename', (req, res, next) => {
  // Check for token in query parameter first, then in Authorization header
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token required. Provide token as query parameter (?token=...) or Authorization header.'
    });
  }
  
  // Set the token in the Authorization header for the middleware
  req.headers.authorization = `Bearer ${token}`;
  next();
}, authenticateToken, authenticateAssignmentFile, (req, res) => {
  req.params.type = 'assignments';
  serveFile(req, res);
});

app.get('/uploads/submissions/:filename', (req, res, next) => {
  // Check for token in query parameter first, then in Authorization header
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token required. Provide token as query parameter (?token=...) or Authorization header.'
    });
  }
  
  // Set the token in the Authorization header for the middleware
  req.headers.authorization = `Bearer ${token}`;
  next();
}, authenticateToken, authenticateSubmissionFile, (req, res) => {
  req.params.type = 'submissions';
  serveFile(req, res);
});

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

// Centralized error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server with Socket.IO for realtime events
serverInstance = require('http').createServer(app);
try {
  const { Server } = require('socket.io');
  io = new Server(serverInstance, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:8081'],
      credentials: true
    }
  });

  // Basic room subscription: clients can join class rooms like `class_<classId>`
  io.on('connection', (socket) => {
    socket.on('subscribe', ({ room }) => {
      if (!room || typeof room !== 'string') return;
      if (room.startsWith('class_') || room.startsWith('student_') || room.startsWith('parent_')) {
        socket.join(room);
      }
    });
  });

  app.set('io', io);
} catch (e) {
  console.warn('Socket.IO not initialized:', e.message);
}

serverInstance.listen(PORT, () => {
  console.log(`🚀 EduAI Authentication API server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔐 API endpoints available at: http://localhost:${PORT}${BASE_PATH}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 