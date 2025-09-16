const axios = require('axios');

class AICallService {
  constructor() {
    this.apiKey = process.env.AI_CALL_API_KEY;
    this.serviceURL = process.env.AI_CALL_SERVICE_URL || 'https://api.elevenlabs.io/v1';
    this.voiceId = process.env.AI_CALL_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default voice
  }

  /**
   * Schedule an AI call to a phone number
   * @param {string} phoneNumber - Phone number in international format
   * @param {string} script - Call script content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Response from AI call service
   */
  async scheduleCall(phoneNumber, script, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('AI Call API key not configured');
      }

      // Format phone number
      const formattedPhone = phoneNumber.replace(/^\+/, '');

      // For demo purposes, we'll simulate the call
      // In production, integrate with actual AI calling service
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Simulate scheduling
      const scheduledTime = options.scheduledTime || new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      
      // In a real implementation, you would call the actual AI service:
      /*
      const response = await axios.post(
        `${this.serviceURL}/calls`,
        {
          phone_number: formattedPhone,
          script: script,
          voice_id: this.voiceId,
          language: 'en-US',
          scheduled_time: scheduledTime.toISOString(),
          ...options
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      */

      // Simulate response for demo
      const response = {
        data: {
          call_id: callId,
          status: 'scheduled',
          scheduled_at: scheduledTime.toISOString(),
          estimated_duration: '2-3 minutes',
          phone_number: formattedPhone
        }
      };

      return {
        success: true,
        callId: response.data.call_id,
        status: response.data.status,
        scheduledAt: response.data.scheduled_at,
        estimatedDuration: response.data.estimated_duration
      };

    } catch (error) {
      console.error('AI Call scheduling error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Generate attendance call script
   * @param {Object} data - Attendance data
   * @returns {string} - Formatted call script
   */
  generateAttendanceScript(data) {
    const { studentName, parentName, attendanceStatus, date, notes, teacherName } = data;
    
    let statusText = '';
    
    switch (attendanceStatus) {
      case 'absent':
        statusText = 'absent';
        break;
      case 'late':
        statusText = 'late';
        break;
      case 'present':
        statusText = 'present';
        break;
      default:
        statusText = attendanceStatus;
    }

    const script = `Hello ${parentName || 'Parent'}, this is an automated call from the school regarding your child ${studentName}'s attendance. 

Your child was marked as ${statusText} on ${date}. ${notes ? `The reason noted is: ${notes}. ` : ''}${attendanceStatus === 'absent' ? 'We encourage regular attendance for better academic performance. ' : ''}

If you have any questions, please contact the school office. Thank you for your attention. Goodbye.`;

    return script;
  }

  /**
   * Get call status
   * @param {string} callId - Call ID
   * @returns {Promise<Object>} - Call status
   */
  async getCallStatus(callId) {
    try {
      if (!this.apiKey) {
        throw new Error('AI Call API key not configured');
      }

      // In a real implementation, you would call the actual service:
      /*
      const response = await axios.get(
        `${this.serviceURL}/calls/${callId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      */

      // Simulate response for demo
      const response = {
        data: {
          call_id: callId,
          status: 'completed',
          started_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
          completed_at: new Date().toISOString(),
          duration: 180, // 3 minutes
          result: 'success'
        }
      };

      return {
        success: true,
        status: response.data.status,
        startedAt: response.data.started_at,
        completedAt: response.data.completed_at,
        duration: response.data.duration,
        result: response.data.result
      };

    } catch (error) {
      console.error('AI Call status error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Cancel a scheduled call
   * @param {string} callId - Call ID
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelCall(callId) {
    try {
      if (!this.apiKey) {
        throw new Error('AI Call API key not configured');
      }

      // In a real implementation, you would call the actual service:
      /*
      const response = await axios.delete(
        `${this.serviceURL}/calls/${callId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );
      */

      // Simulate response for demo
      return {
        success: true,
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('AI Call cancellation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }
}

module.exports = new AICallService();
