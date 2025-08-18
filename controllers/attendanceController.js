module.exports = {
  getReasons: (req, res) => {
    const reasons = [
      { code: 'sick', label: 'Sick' },
      { code: 'family', label: 'Family Emergency' },
      { code: 'travel', label: 'Travel' },
      { code: 'medical', label: 'Medical Appointment' },
      { code: 'other', label: 'Other' }
    ];
    res.json({ success: true, message: 'Attendance reasons', data: reasons });
  }
};


