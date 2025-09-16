const axios = require('axios');

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.baseURL = `https://graph.facebook.com/v17.0/${this.phoneNumberId}`;
  }

  /**
   * Send WhatsApp message to a phone number
   * @param {string} phoneNumber - Phone number in international format (e.g., +1234567890)
   * @param {string} message - Message content
   * @returns {Promise<Object>} - Response from WhatsApp API
   */
  async sendMessage(phoneNumber, message) {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        throw new Error('WhatsApp credentials not configured');
      }

      // Format phone number (remove + and ensure it's in correct format)
      const formattedPhone = phoneNumber.replace(/^\+/, '');

      const response = await axios.post(
        `${this.baseURL}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        status: 'sent',
        sentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: 'failed'
      };
    }
  }

  /**
   * Generate attendance notification message
   * @param {Object} data - Attendance data
   * @returns {string} - Formatted message
   */
  generateAttendanceMessage(data) {
    const { studentName, parentName, attendanceStatus, date, notes, teacherName } = data;
    
    let statusText = '';
    let emoji = '';
    
    switch (attendanceStatus) {
      case 'absent':
        statusText = 'ABSENT';
        emoji = '❌';
        break;
      case 'late':
        statusText = 'LATE';
        emoji = '⏰';
        break;
      case 'present':
        statusText = 'PRESENT';
        emoji = '✅';
        break;
      default:
        statusText = attendanceStatus.toUpperCase();
        emoji = '📝';
    }

    const message = `Dear ${parentName || 'Parent/Guardian'},

${emoji} Your ward *${studentName}* was marked as *${statusText}* on ${date}.

${notes ? `Reason: ${notes}\n\n` : ''}${attendanceStatus === 'absent' ? 'Please ensure regular attendance for better academic performance.\n\n' : ''}Best regards,
${teacherName || 'School Administration'}

---
*This is an automated message from the school management system.*`;

    return message;
  }

  /**
   * Verify webhook (for WhatsApp webhook setup)
   * @param {string} mode - Verification mode
   * @param {string} token - Verification token
   * @param {string} challenge - Challenge string
   * @returns {string|null} - Challenge if verified, null otherwise
   */
  verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    
    return null;
  }
}

module.exports = new WhatsAppService();
