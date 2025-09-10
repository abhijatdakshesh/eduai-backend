const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignmentController');
const { authenticateToken, requireUserType } = require('../middleware/auth');
const { uploadAssignmentMiddleware, uploadSubmissionMiddleware, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authenticateToken);

// Teacher routes
router.post('/teacher/create', requireUserType(['teacher']), uploadAssignmentMiddleware, handleUploadError, assignmentController.createAssignment);
router.get('/teacher/assignments', requireUserType(['teacher']), assignmentController.getTeacherAssignments);
router.get('/teacher/assignments/:assignmentId', requireUserType(['teacher']), assignmentController.getAssignmentDetails);
router.put('/teacher/assignments/:assignmentId', requireUserType(['teacher']), uploadAssignmentMiddleware, handleUploadError, assignmentController.updateAssignment);
router.delete('/teacher/assignments/:assignmentId', requireUserType(['teacher']), assignmentController.deleteAssignment);
router.put('/teacher/submissions/:submissionId/grade', requireUserType(['teacher']), assignmentController.gradeSubmission);

// File access routes (for both teachers and students)
router.get('/teacher/submissions/:submissionId/attachments/:attachmentId/url', requireUserType(['teacher']), assignmentController.getSubmissionFileUrl);
router.get('/student/submissions/:submissionId/attachments/:attachmentId/url', requireUserType(['student']), assignmentController.getSubmissionFileUrl);
router.get('/teacher/assignments/:assignmentId/attachments/:attachmentId/url', requireUserType(['teacher']), assignmentController.getAssignmentFileUrl);
router.get('/student/assignments/:assignmentId/attachments/:attachmentId/url', requireUserType(['student']), assignmentController.getAssignmentFileUrl);

// Student routes
router.get('/student/assignments', requireUserType(['student']), assignmentController.getStudentAssignments);
router.get('/student/assignments/:assignmentId', requireUserType(['student']), assignmentController.getAssignmentDetails);
router.post('/student/assignments/:assignmentId/submit', requireUserType(['student']), uploadSubmissionMiddleware, handleUploadError, assignmentController.submitAssignment);

// Admin routes (optional - for admin to view all assignments)
router.get('/admin/assignments', requireUserType(['admin']), assignmentController.getTeacherAssignments);

module.exports = router;
