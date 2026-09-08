const express = require('express');
const controller = require('../controllers/officerResponsibilityController');

const router = express.Router();
router.get('/', controller.list);
router.post('/permanent', controller.permanent);
router.post('/temporary', controller.temporary);
router.patch('/officers/:officerId/availability', controller.availability);
router.patch('/temporary/:assignmentId', controller.transition);

module.exports = router;
