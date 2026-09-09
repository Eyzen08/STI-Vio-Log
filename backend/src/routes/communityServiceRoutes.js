const router = require('express').Router();
const service = require('../controllers/communityServiceController');
const attendance = require('../controllers/communityServiceAttendanceController');
const { authorizeRoles, authorizePermissions, requireAuthorizedDepartment } = require('../middleware/authMiddleware');
const { PERMISSIONS } = require('../security/permissions');

const operationalStaff = authorizeRoles('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE');
const serviceReaders = authorizeRoles('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD');
const canReadAssignments = authorizePermissions(PERMISSIONS.STUDENT_BASIC_VIEW);
const canManageAssignments = authorizePermissions(PERMISSIONS.SERVICE_ASSIGNMENT_MANAGE);
const canScan = authorizePermissions(PERMISSIONS.ATTENDANCE_SCAN);
const canCorrectDtr = authorizePermissions(PERMISSIONS.DTR_CORRECT);

router.get('/my-assignment', authorizeRoles('STUDENT'), service.getMyCommunityServiceAssignment);
router.post('/attendance/time-in', canScan, serviceReaders, requireAuthorizedDepartment, attendance.communityServiceTimeIn);
router.post('/attendance/time-out', canScan, serviceReaders, requireAuthorizedDepartment, attendance.communityServiceTimeOut);
router.get('/results/pending', canCorrectDtr, operationalStaff, attendance.getPendingServiceResults);
router.post('/results/:sessionId/review', canCorrectDtr, operationalStaff, attendance.reviewCommunityServiceResult);
router.get('/assignment-options', canManageAssignments, operationalStaff, service.getCommunityServiceAssignmentOptions);
router.get('/active-sessions', canReadAssignments, serviceReaders, attendance.getActiveDepartmentSessions);
router.get('/:assignmentId/sessions', canReadAssignments, serviceReaders, attendance.getCommunityServiceSessions);
router.get('/attendance/:assignmentId', canReadAssignments, serviceReaders, attendance.getCommunityServiceAttendance);
router.get('/', canReadAssignments, serviceReaders, service.getCommunityServiceAssignments);
router.post('/', canManageAssignments, operationalStaff, service.createCommunityServiceAssignment);
router.get('/:id', canReadAssignments, serviceReaders, service.getCommunityServiceAssignmentById);
router.put('/:id', canManageAssignments, operationalStaff, service.updateCommunityServiceAssignment);
router.delete('/:id', canManageAssignments, operationalStaff, service.deleteCommunityServiceAssignment);

module.exports = router;
