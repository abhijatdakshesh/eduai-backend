const db = require('../config/database');

// Get dashboard stats
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // For now, return mock data since the user might not have enrollments yet
    // In a real implementation, you would query the database for actual data
    
    // Return stats as an array of stat cards for the frontend
    const stats = [
      {
        id: 'gpa',
        title: 'GPA',
        value: '3.75',
        icon: '📊',
        color: '#4CAF50'
      },
      {
        id: 'courses_enrolled',
        title: 'Courses Enrolled',
        value: 4,
        icon: '📚',
        color: '#2196F3'
      },
      {
        id: 'assignments_due',
        title: 'Assignments Due',
        value: 5,
        icon: '📝',
        color: '#FF9800'
      },
      {
        id: 'attendance',
        title: 'Attendance',
        value: '85%',
        icon: '✅',
        color: '#9C27B0'
      }
    ];

    // Mock recent activities
    const recentActivities = [
      {
        type: 'enrollment',
        title: 'Introduction to Computer Science',
        description: 'Enrolled in CS101',
        date: new Date().toISOString()
      },
      {
        type: 'assignment',
        title: 'Data Structures Assignment',
        description: 'Assignment submitted',
        date: new Date(Date.now() - 86400000).toISOString()
      }
    ];

    // Mock performance metrics
    const performanceMetrics = [
      {
        department: 'Computer Science',
        average_gpa: 3.8,
        courses_count: 2
      },
      {
        department: 'Mathematics',
        average_gpa: 3.6,
        courses_count: 1
      }
    ];

    res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        stats,
        recent_activities: recentActivities,
        performance_metrics: performanceMetrics
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard stats'
    });
  }
};

// Get quick actions
const getQuickActions = async (req, res) => {
  try {
    const quickActions = [
      {
        id: 'course_registration',
        title: 'Course Registration',
        description: 'Register for upcoming semester courses',
        icon: '📚',
        route: '/courses/register'
      },
      {
        id: 'fee_payment',
        title: 'Fee Payment',
        description: 'Pay your tuition and other fees',
        icon: '💰',
        route: '/finance/payment'
      },
      {
        id: 'job_search',
        title: 'Job Search',
        description: 'Browse available job opportunities',
        icon: '💼',
        route: '/jobs'
      },
      {
        id: 'schedule_view',
        title: 'View Schedule',
        description: 'Check your class schedule',
        icon: '📅',
        route: '/schedule'
      },
      {
        id: 'results_view',
        title: 'View Results',
        description: 'Check your academic results',
        icon: '📊',
        route: '/results'
      },
      {
        id: 'ai_assistant',
        title: 'AI Assistant',
        description: 'Get help from AI assistant',
        icon: '🤖',
        route: '/ai-assistant'
      }
    ];

    res.json({
      success: true,
      message: 'Quick actions retrieved successfully',
      data: quickActions
    });

  } catch (error) {
    console.error('Quick actions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve quick actions'
    });
  }
};

module.exports = {
  getDashboardStats,
  getQuickActions
};
