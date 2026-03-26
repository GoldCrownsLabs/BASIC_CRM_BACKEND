// controllers/supportController.js

const { validationResult } = require("express-validator");
const supportService = require("../services/supportService");

class SupportController {
  // Get FAQs
  async getFAQs(req, res) {
    try {
      const { category, search, page, limit } = req.query;
      const result = await supportService.getFAQs({
        category,
        search,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.faqs,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching FAQs:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch FAQs",
        error: error.message,
      });
    }
  }

  // Get FAQ categories
  async getFAQCategories(req, res) {
    try {
      const categories = await supportService.getFAQCategories();

      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
        error: error.message,
      });
    }
  }

  // Track FAQ helpfulness
  async trackFAQHelpfulness(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { faqId, helpful } = req.body;
      const userId = req.user?.id;
      const userData = req.user
        ? { name: req.user.name, email: req.user.email }
        : null;

      await supportService.trackFAQHelpfulness(
        faqId,
        helpful,
        userId,
        userData,
      );

      res.json({
        success: true,
        message: "Feedback recorded",
      });
    } catch (error) {
      console.error("Error tracking FAQ helpfulness:", error);
      res.status(500).json({
        success: false,
        message: "Failed to record feedback",
        error: error.message,
      });
    }
  }

  // Submit support ticket
  async submitTicket(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, subject, message, faqCategory, deviceInfo } =
        req.body;
      const userId = req.user?.id;

      const ticket = await supportService.createTicket({
        type: "support",
        userId,
        name,
        email,
        subject,
        message,
        faqCategory: faqCategory || "Other",
        deviceInfo: deviceInfo || {},
        status: "open",
      });

      res.status(201).json({
        success: true,
        message: "Support ticket submitted successfully",
        data: {
          ticketId: ticket.ticketId,
          ticket,
        },
      });
    } catch (error) {
      console.error("Error submitting ticket:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit support ticket",
        error: error.message,
      });
    }
  }

  // Submit feedback
  async submitFeedback(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, rating, comment, deviceInfo } = req.body;
      const userId = req.user?.id;

      const feedback = await supportService.createFeedback({
        type: "feedback",
        userId,
        name,
        email,
        rating,
        feedbackComment: comment,
        deviceInfo: deviceInfo || {},
        status: "closed",
      });

      res.status(201).json({
        success: true,
        message: "Feedback submitted successfully",
        data: {
          feedbackId: feedback.ticketId,
        },
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit feedback",
        error: error.message,
      });
    }
  }

  // Get user's tickets
  async getUserTickets(req, res) {
    try {
      const userId = req.user.id;
      const { status, type, page, limit } = req.query;

      const result = await supportService.getUserTickets(userId, {
        status,
        type,
        page,
        limit,
      });

      res.json({
        success: true,
        data: result.tickets,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch tickets",
        error: error.message,
      });
    }
  }

  // Get single ticket
  async getTicket(req, res) {
    try {
      const { ticketId } = req.params;
      const userId = req.user.id;
      const isAdmin = req.user.role === "admin";

      const ticket = await supportService.getTicketById(
        ticketId,
        userId,
        isAdmin,
      );

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      res.json({
        success: true,
        data: ticket,
      });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch ticket",
        error: error.message,
      });
    }
  }

  // Add response to ticket
  async addResponse(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ticketId } = req.params;
      const { message, attachments } = req.body;
      const userId = req.user.id;

      const ticket = await supportService.addResponse(
        ticketId,
        userId,
        message,
        attachments,
      );

      res.json({
        success: true,
        message: "Response added successfully",
        data: ticket,
      });
    } catch (error) {
      console.error("Error adding response:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to add response",
        error: error.message,
      });
    }
  }

  // Get all tickets (admin only)
  async getAllTickets(req, res) {
    try {
      const { status, type, page, limit, search } = req.query;

      const result = await supportService.getAllTickets({
        status,
        type,
        page,
        limit,
        search,
      });

      res.json({
        success: true,
        data: result.tickets,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Error fetching all tickets:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch tickets",
        error: error.message,
      });
    }
  }

  // Update ticket status (admin only)
  async updateTicketStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ticketId } = req.params;
      const { status, priority, assignedTo } = req.body;

      const ticket = await supportService.updateTicketStatus(ticketId, {
        status,
        priority,
        assignedTo,
      });

      res.json({
        success: true,
        message: "Ticket updated successfully",
        data: ticket,
      });
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to update ticket",
        error: error.message,
      });
    }
  }

  // Get support statistics (admin only)
  async getStatistics(req, res) {
    try {
      const statistics = await supportService.getStatistics();

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      console.error("Error fetching statistics:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch statistics",
        error: error.message,
      });
    }
  }
}

module.exports = new SupportController();
