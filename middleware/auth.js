const jwtUtils = require('../utils/jwtUtils');
const db = require('../config/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);
    
    const decoded = jwtUtils.verifyToken(token);
    
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Check if user exists and is active
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name, user_type, email_verified, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required'
    });
  }
  next();
};

const requireUserType = (allowedTypes) => {
  return (req, res, next) => {
    if (!allowedTypes.includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }
    next();
  };
};

const extractDeviceInfo = (req, res, next) => {
  req.deviceInfo = {
    deviceId: req.headers['x-device-id'] || 'unknown',
    deviceType: req.headers['x-platform'] || 'unknown',
    osVersion: req.headers['x-os-version'] || 'unknown',
    appVersion: req.headers['x-client-version'] || 'unknown',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    country: req.headers['x-country'] || null,
    state: req.headers['x-state'] || null,
    city: req.headers['x-city'] || null,
    timezone: req.headers['x-timezone'] || null
  };
  next();
};

module.exports = {
  authenticateToken,
  requireEmailVerification,
  requireUserType,
  extractDeviceInfo
}; 