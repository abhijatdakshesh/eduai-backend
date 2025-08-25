const db = require('../config/database');
const jwtUtils = require('../utils/jwtUtils');
const emailService = require('../utils/emailService');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class AuthController {
  // Register new user
  async register(req, res) {
    const startTime = Date.now();
    const requestId = uuidv4();
    
    try {
      const {
        email,
        password,
        first_name,
        last_name,
        user_type,
        phone,
        date_of_birth,
        gender,
        terms_accepted,
        privacy_policy_accepted,
        marketing_consent,
        device_info,
        location_info
      } = req.body;

      // Check if user already exists
      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      // Hash password
      const passwordHash = jwtUtils.hashPassword(password);

      // Create user
      const userResult = await db.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name, user_type, 
          phone, date_of_birth, gender
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id, email, first_name, last_name, user_type, email_verified`,
        [email, passwordHash, first_name, last_name, user_type, 
         phone, date_of_birth, gender]
      );

      const user = userResult.rows[0];

      // Generate verification token
      const verificationToken = jwtUtils.generateVerificationToken();
      const expiresAt = moment().add(24, 'hours').toDate();

      await db.query(
        `INSERT INTO verification_tokens (user_id, token, type, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [user.id, verificationToken, 'email_verification', expiresAt]
      );

      // Send verification email (skip if email not configured)
      try {
        await emailService.sendVerificationEmail(email, verificationToken, first_name);
      } catch (emailError) {
        console.log('Email service not configured, skipping verification email:', emailError.message);
      }

      // Generate tokens
      const accessToken = jwtUtils.generateAccessToken(user.id, user.user_type);
      const refreshToken = jwtUtils.generateRefreshToken(user.id, device_info?.device_id || 'unknown');

      // Create session (with field truncation and logging)
      const sessionExpiresAt = moment().add(7, 'days').toDate();
      let deviceId = (device_info?.device_id || 'unknown').toString().substring(0, 100);
      let deviceType = (device_info?.device_type || '').toString().substring(0, 50);
      let osVersion = (device_info?.os_version || '').toString().substring(0, 50);
      let appVersion = (device_info?.app_version || '').toString().substring(0, 20);
      let ipAddress = (req.deviceInfo?.ipAddress || '').toString();
      let userAgent = (req.deviceInfo?.userAgent || '').toString();
      let country = (location_info?.country || '').toString().substring(0, 10);
      let state = (location_info?.state || '').toString().substring(0, 100);
      let city = (location_info?.city || '').toString().substring(0, 100);
      let timezone = (location_info?.timezone || '').toString().substring(0, 100);
      let refreshTokenTrunc = refreshToken.toString().substring(0, 255);
      
      console.log('Session insert values:', {
        userId: user.id, refreshTokenTrunc, deviceId, deviceType, osVersion, appVersion, ipAddress, userAgent, country, state, city, timezone, sessionExpiresAt
      });
      await db.query(
        `INSERT INTO user_sessions (
          user_id, refresh_token, device_id, device_type, os_version, 
          app_version, ip_address, user_agent, country, state, city, timezone, expires_at, is_active, last_activity_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          user.id, refreshTokenTrunc, deviceId,
          deviceType, osVersion, appVersion,
          ipAddress, userAgent,
          country, state, city, timezone,
          sessionExpiresAt, true, new Date()
        ]
      );

      // Log audit (temporarily disabled for debugging)
      console.log('Registration successful for user:', user.id);

      const processingTime = Date.now() - startTime;

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.',
        data: {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            email_verified: user.email_verified
          },
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken
          },
          verification: {
            verification_token: verificationToken,
            expires_at: expiresAt
          }
        },
        metadata: {
          request_id: requestId,
          processing_time_ms: processingTime,
          rate_limit_remaining: req.rateLimit?.remaining || 'unknown'
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login user
  async login(req, res) {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const { email, password, device_info, location_info } = req.body;

      // Find user
      const userResult = await db.query(
        'SELECT id, email, password_hash, first_name, last_name, user_type, email_verified, is_active FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Verify password
      if (!jwtUtils.comparePassword(password, user.password_hash)) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate tokens
      const accessToken = jwtUtils.generateAccessToken(user.id, user.user_type);
      const refreshToken = jwtUtils.generateRefreshToken(user.id, device_info?.device_id || 'unknown');

      // Update last login
      await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Temporarily skip session management for debugging
      console.log('Login successful for user:', user.id);

      const processingTime = Date.now() - startTime;

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            email_verified: user.email_verified
          },
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken
          }
        },
        metadata: {
          request_id: requestId,
          processing_time_ms: processingTime,
          rate_limit_remaining: req.rateLimit?.remaining || 'unknown'
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { verification_token } = req.body;

      // Find and validate token
      const tokenResult = await db.query(
        `SELECT vt.*, u.email, u.first_name, u.email_verified 
         FROM verification_tokens vt 
         JOIN users u ON vt.user_id = u.id 
         WHERE vt.token = $1 AND vt.type = 'email_verification' AND vt.used_at IS NULL`,
        [verification_token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      const token = tokenResult.rows[0];

      if (moment().isAfter(token.expires_at)) {
        return res.status(400).json({
          success: false,
          message: 'Verification token has expired'
        });
      }

      if (token.email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Mark token as used
      await db.query(
        'UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [token.id]
      );

      // Mark email as verified
      await db.query(
        'UPDATE users SET email_verified = TRUE, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
        [token.user_id]
      );

      // Send welcome email
      await emailService.sendWelcomeEmail(token.email, token.first_name);

      // Log audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          token.user_id, 'email_verified', 'user', token.user_id,
          JSON.stringify({ verification_token }),
          req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, req.deviceInfo?.deviceId
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Email verified successfully',
        data: {
          email_verified: true
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during email verification'
      });
    }
  }

  // Resend verification email
  async resendVerification(req, res) {
    try {
      const { email } = req.body;

      // Find user
      const userResult = await db.query(
        'SELECT id, email, first_name, email_verified FROM users WHERE email = $1',
        [email]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          message: 'Email is already verified'
        });
      }

      // Generate new verification token
      const verificationToken = jwtUtils.generateVerificationToken();
      const expiresAt = moment().add(24, 'hours').toDate();

      // Invalidate old tokens
      await db.query(
        'UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND type = $2 AND used_at IS NULL',
        [user.id, 'email_verification']
      );

      // Create new token
      await db.query(
        `INSERT INTO verification_tokens (user_id, token, type, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [user.id, verificationToken, 'email_verification', expiresAt]
      );

      // Send verification email
      await emailService.sendVerificationEmail(email, verificationToken, user.first_name);

      // Log audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id, 'verification_email_resent', 'user', user.id,
          JSON.stringify({ verification_token: verificationToken }),
          req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, req.deviceInfo?.deviceId
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully',
        data: {
          email_sent: true
        }
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while resending verification email'
      });
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      // Find user
      const userResult = await db.query(
        'SELECT id, email, first_name FROM users WHERE email = $1 AND is_active = TRUE',
        [email]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if user exists or not for security
        return res.status(200).json({
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent',
          data: {
            reset_email_sent: true
          }
        });
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = jwtUtils.generateResetToken();
      const expiresAt = moment().add(1, 'hour').toDate();

      // Invalidate old reset tokens
      await db.query(
        'UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND type = $2 AND used_at IS NULL',
        [user.id, 'password_reset']
      );

      // Create new reset token
      await db.query(
        `INSERT INTO verification_tokens (user_id, token, type, expires_at) 
         VALUES ($1, $2, $3, $4)`,
        [user.id, resetToken, 'password_reset', expiresAt]
      );

      // Send reset email
      await emailService.sendPasswordResetEmail(email, resetToken, user.first_name);

      // In non-production, also include the reset URL in the API response to ease testing
      const isNonProd = (process.env.NODE_ENV || 'development') !== 'production';
      const resetUrlForResponse = isNonProd
        ? `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
        : undefined;

      // Log audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id, 'password_reset_requested', 'user', user.id,
          JSON.stringify({ reset_token: resetToken }),
          req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, req.deviceInfo?.deviceId
        ]
      );

      res.status(200).json({
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent',
        data: {
          reset_email_sent: true,
          ...(isNonProd ? { reset_token: resetToken, reset_url: resetUrlForResponse } : {})
        }
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset request'
      });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { reset_token, new_password } = req.body;

      // Find and validate token
      const tokenResult = await db.query(
        `SELECT vt.*, u.email, u.first_name 
         FROM verification_tokens vt 
         JOIN users u ON vt.user_id = u.id 
         WHERE vt.token = $1 AND vt.type = 'password_reset' AND vt.used_at IS NULL`,
        [reset_token]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
      }

      const token = tokenResult.rows[0];

      if (moment().isAfter(token.expires_at)) {
        return res.status(400).json({
          success: false,
          message: 'Reset token has expired'
        });
      }

      // Mark token as used
      await db.query(
        'UPDATE verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1',
        [token.id]
      );

      // Update password
      const passwordHash = jwtUtils.hashPassword(new_password);
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [passwordHash, token.user_id]
      );

      // Invalidate all sessions (force re-login)
      await db.query(
        'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1',
        [token.user_id]
      );

      // Log audit
      await db.query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          token.user_id, 'password_reset', 'user', token.user_id,
          JSON.stringify({ reset_token }),
          req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, req.deviceInfo?.deviceId
        ]
      );

      res.status(200).json({
        success: true,
        message: 'Password reset successfully',
        data: {
          password_reset: true
        }
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during password reset'
      });
    }
  }

  // Get user sessions
  async getUserSessions(req, res) {
    try {
      // Temporarily return empty sessions for debugging
      res.status(200).json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions: [],
          total_sessions: 0
        }
      });

    } catch (error) {
      console.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving sessions'
      });
    }
  }

  // Refresh token
  async refreshToken(req, res) {
    try {
      const { device_id } = req.body;
      const authHeader = req.headers.authorization;
      const refreshToken = jwtUtils.extractTokenFromHeader(authHeader);

      // Verify refresh token
      const decoded = jwtUtils.verifyToken(refreshToken);
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      // Temporarily skip session validation for debugging
      // Generate new tokens
      const newAccessToken = jwtUtils.generateAccessToken(decoded.userId, decoded.userType);
      const newRefreshToken = jwtUtils.generateRefreshToken(decoded.userId, device_id);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          access_token: newAccessToken,
          refresh_token: newRefreshToken
        }
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during token refresh'
      });
    }
  }

  // Get user profile
  async getUserProfile(req, res) {
    try {
      const userResult = await db.query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.user_type, 
                u.phone, u.date_of_birth, u.gender, u.email_verified, 
                u.last_login, u.created_at, u.updated_at,
                u.avatar_url
         FROM users u
         WHERE u.id = $1`,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            user_type: user.user_type,
            phone: user.phone,
            date_of_birth: user.date_of_birth,
            gender: user.gender,
            email_verified: user.email_verified,
            last_login: user.last_login,
            created_at: user.created_at,
            updated_at: user.updated_at,
            avatar_url: user.avatar_url
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while retrieving profile'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      const { device_id, logout_all_sessions } = req.body;

      if (logout_all_sessions) {
        // Logout from all sessions
        const result = await db.query(
          'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND is_active = TRUE RETURNING id',
          [req.user.id]
        );

        // Log audit
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id, 'logout_all_sessions', 'user', req.user.id,
            JSON.stringify({ sessions_terminated: result.rows.length }),
            req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, device_id
          ]
        );

        res.status(200).json({
          success: true,
          message: 'Logged out from all sessions',
          data: {
            logged_out: true,
            sessions_terminated: result.rows.length
          }
        });
      } else {
        // Logout from current session only
        const result = await db.query(
          'UPDATE user_sessions SET is_active = FALSE WHERE user_id = $1 AND device_id = $2 AND is_active = TRUE RETURNING id',
          [req.user.id, device_id]
        );

        // Log audit
        await db.query(
          `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent, device_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            req.user.id, 'logout_session', 'user', req.user.id,
            JSON.stringify({ device_id }),
            req.deviceInfo?.ipAddress, req.deviceInfo?.userAgent, device_id
          ]
        );

        res.status(200).json({
          success: true,
          message: 'Logged out successfully',
          data: {
            logged_out: true
          }
        });
      }

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout'
      });
    }
  }
}

module.exports = new AuthController(); 