const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

class JWTUtils {
  generateAccessToken(userId, userType) {
    return jwt.sign(
      { 
        userId, 
        userType,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' 
      }
    );
  }

  generateRefreshToken(userId, deviceId) {
    return jwt.sign(
      { 
        userId, 
        deviceId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' 
      }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  generateVerificationToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateResetToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  hashPassword(password) {
    const bcrypt = require('bcryptjs');
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    return bcrypt.hashSync(password, saltRounds);
  }

  comparePassword(password, hash) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compareSync(password, hash);
  }

  generateDeviceId() {
    return 'device_' + Date.now().toString().slice(-8) + '_' + crypto.randomBytes(4).toString('hex');
  }

  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }
    return authHeader.substring(7);
  }
}

module.exports = new JWTUtils(); 