const express = require("express");
const router = express.Router();
const { protect, admin } = require("../middleware/auth");
const {
  createTemplate,
  getTemplates,
  getAllTemplatesAdmin, 
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  sendTemplateToLeads,
  previewTemplate,
  testEmailConfig,
  getVariablesHelp,
} = require("../controllers/templateController");

// All routes are protected
router.use(protect);

// Template CRUD
router.route("/").post(createTemplate).get(getTemplates);



// Helper routes
router.get("/variables-help", getVariablesHelp);
router.get("/test-email", testEmailConfig);
router.post("/preview", previewTemplate);

// Single template operations
router
  .route("/:id")
  .get(getTemplateById)
  .put(updateTemplate)
  .delete(protect, deleteTemplate); 

// Send template to leads
router.post("/:id/send", sendTemplateToLeads);

module.exports = router;
