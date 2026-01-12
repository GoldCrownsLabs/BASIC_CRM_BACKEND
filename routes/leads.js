// routes/leads.js
const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController'); 
const { protect } = require('../middleware/auth'); 

// Apply auth middleware to all routes
router.use(protect);

// Lead routes
router.route('/')
  .post(leadController.createLead)
  .get(leadController.getLeads);

router.route('/assigned/me')
  .get(leadController.getMyLeads);

router.route('/summary/stats')
  .get(leadController.getLeadStats);

router.route('/bulk-update')
  .put(leadController.bulkUpdateLeads);

router.route('/:id')
  .get(leadController.getLeadById)
  .put(leadController.updateLead)
  .delete(leadController.deleteLead);

router.route('/:id/notes')
  .post(leadController.addNote);

router.route('/:id/status')
  .patch(leadController.updateLeadStatus);

module.exports = router;