const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    
    res.status(200).json({
      success: true,
      message: 'EduAI Authentication API is running',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      message: 'Service unavailable',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      }
    });
  }
});

module.exports = router; 