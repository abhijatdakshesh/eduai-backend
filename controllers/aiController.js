const db = require('../config/database');

// Send message to AI assistant
const sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    // Simple AI response logic (can be enhanced with actual AI integration)
    let response = '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('gpa') || lowerMessage.includes('grade')) {
      response = 'You can check your GPA and grades in the Results section. Your current GPA is calculated based on all completed courses.';
    } else if (lowerMessage.includes('course') || lowerMessage.includes('register')) {
      response = 'Course registration is available in the Courses section. You can browse available courses and enroll in them.';
    } else if (lowerMessage.includes('fee') || lowerMessage.includes('payment')) {
      response = 'You can view your fees and make payments in the Finance section. All payment methods are accepted.';
    } else if (lowerMessage.includes('schedule') || lowerMessage.includes('class')) {
      response = 'Your class schedule is available in the Schedule section. You can view daily and weekly schedules.';
    } else if (lowerMessage.includes('job') || lowerMessage.includes('career')) {
      response = 'Job opportunities are available in the Job Portal section. You can browse and apply for various positions.';
    } else if (lowerMessage.includes('service') || lowerMessage.includes('booking')) {
      response = 'Campus services like library, health center, and IT support can be booked through the Campus Services section.';
    } else if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
      response = 'I\'m here to help! You can ask me about courses, grades, fees, schedule, jobs, or campus services. What would you like to know?';
    } else {
      response = 'I understand you\'re asking about "' + message + '". Please check the relevant section in the app or ask me a more specific question about courses, grades, fees, schedule, jobs, or campus services.';
    }

    // Save message and response to chat history
    await db.query(`
      INSERT INTO chat_history (user_id, message, response, message_type)
      VALUES ($1, $2, $3, 'user')
    `, [userId, message, response]);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        response,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Get chat history
const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const chatHistory = await db.query(`
      SELECT 
        id,
        message,
        response,
        message_type,
        created_at
      FROM chat_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    // Get total count
    const countResult = await db.query(`
      SELECT COUNT(*) as total
      FROM chat_history
      WHERE user_id = $1
    `, [userId]);

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      message: 'Chat history retrieved successfully',
      data: {
        messages: chatHistory.rows.reverse(), // Reverse to show oldest first
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve chat history'
    });
  }
};

// Clear chat history
const clearChatHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    await db.query(`
      DELETE FROM chat_history
      WHERE user_id = $1
    `, [userId]);

    res.json({
      success: true,
      message: 'Chat history cleared successfully'
    });

  } catch (error) {
    console.error('Clear chat history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat history'
    });
  }
};

// Get quick actions
const getQuickActions = async (req, res) => {
  try {
    const quickActions = [
      {
        id: 'check_gpa',
        title: 'Check My GPA',
        description: 'Get information about your current GPA and academic performance',
        icon: '📊',
        action: 'What is my current GPA?'
      },
      {
        id: 'course_registration',
        title: 'Course Registration',
        description: 'Learn how to register for courses',
        icon: '📚',
        action: 'How do I register for courses?'
      },
      {
        id: 'fee_payment',
        title: 'Fee Payment',
        description: 'Get information about fee payment methods',
        icon: '💰',
        action: 'How can I pay my fees?'
      },
      {
        id: 'class_schedule',
        title: 'Class Schedule',
        description: 'Check your class schedule',
        icon: '📅',
        action: 'What is my class schedule?'
      },
      {
        id: 'job_opportunities',
        title: 'Job Opportunities',
        description: 'Find job opportunities and career guidance',
        icon: '💼',
        action: 'What job opportunities are available?'
      },
      {
        id: 'campus_services',
        title: 'Campus Services',
        description: 'Get information about campus services',
        icon: '🏢',
        action: 'What campus services are available?'
      },
      {
        id: 'academic_calendar',
        title: 'Academic Calendar',
        description: 'Check important academic dates',
        icon: '📆',
        action: 'What are the important academic dates?'
      },
      {
        id: 'contact_support',
        title: 'Contact Support',
        description: 'Get help and contact information',
        icon: '📞',
        action: 'How can I contact support?'
      }
    ];

    res.json({
      success: true,
      message: 'Quick actions retrieved successfully',
      data: quickActions
    });

  } catch (error) {
    console.error('Get quick actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quick actions'
    });
  }
};

// Execute quick action
const executeQuickAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { actionId } = req.params;

    const quickActions = {
      'check_gpa': 'What is my current GPA?',
      'course_registration': 'How do I register for courses?',
      'fee_payment': 'How can I pay my fees?',
      'class_schedule': 'What is my class schedule?',
      'job_opportunities': 'What job opportunities are available?',
      'campus_services': 'What campus services are available?',
      'academic_calendar': 'What are the important academic dates?',
      'contact_support': 'How can I contact support?'
    };

    const message = quickActions[actionId];
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Quick action not found'
      });
    }

    // Generate response for the quick action
    let response = '';
    switch (actionId) {
      case 'check_gpa':
        response = 'You can check your GPA in the Results section. Your GPA is calculated based on all completed courses with published grades.';
        break;
      case 'course_registration':
        response = 'Course registration is available in the Courses section. Browse available courses, check prerequisites, and enroll in courses that fit your schedule.';
        break;
      case 'fee_payment':
        response = 'Fee payments can be made through the Finance section. Multiple payment methods are accepted including credit cards, bank transfers, and online payment systems.';
        break;
      case 'class_schedule':
        response = 'Your class schedule is available in the Schedule section. You can view daily schedules, weekly schedules, and navigate between different weeks.';
        break;
      case 'job_opportunities':
        response = 'Job opportunities are available in the Job Portal section. Browse internships, full-time positions, and part-time jobs posted by various companies.';
        break;
      case 'campus_services':
        response = 'Campus services include library, health center, IT support, dining services, transportation, and hostel services. You can book appointments through the Campus Services section.';
        break;
      case 'academic_calendar':
        response = 'Important academic dates include course registration deadlines, exam schedules, fee payment deadlines, and semester start/end dates. Check the academic calendar for specific dates.';
        break;
      case 'contact_support':
        response = 'For technical support, contact IT support. For academic queries, contact your department office. For general inquiries, email support@eduai.com or call the main office.';
        break;
      default:
        response = 'I\'m here to help! Please ask me a specific question about your academic journey.';
    }

    // Save to chat history
    await db.query(`
      INSERT INTO chat_history (user_id, message, response, message_type)
      VALUES ($1, $2, $3, 'user')
    `, [userId, message, response]);

    res.json({
      success: true,
      message: 'Quick action executed successfully',
      data: {
        action_id: actionId,
        message,
        response,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Execute quick action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute quick action'
    });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  getQuickActions,
  executeQuickAction
};
