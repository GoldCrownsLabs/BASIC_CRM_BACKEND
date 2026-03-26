// services/supportService.js

const Support = require("../models/Support");
const FAQ = require("../models/FAQ");

class SupportService {
  /**
   * Create a new support ticket
   */
  async createTicket(ticketData) {
    const ticket = new Support(ticketData);
    await ticket.save();
    return ticket;
  }

  /**
   * Create feedback entry
   */
  async createFeedback(feedbackData) {
    const feedback = new Support(feedbackData);
    await feedback.save();
    return feedback;
  }

  /**
   * Get user tickets with pagination
   */
  async getUserTickets(userId, query = {}) {
    const { status, type, page = 1, limit = 10 } = query;

    const filter = { userId };
    if (status) filter.status = status;
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await Support.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Support.countDocuments(filter);

    return {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  /**
   * Get single ticket by ID
   */
  async getTicketById(ticketId, userId = null, isAdmin = false) {
    const query = { ticketId };

    if (!isAdmin && userId) {
      query.userId = userId;
    }

    return await Support.findOne(query);
  }

  /**
   * Add response to ticket
   */
  async addResponse(ticketId, userId, message, attachments = []) {
    const ticket = await Support.findOne({ ticketId, userId });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (ticket.status === "closed") {
      throw new Error("Cannot respond to closed tickets");
    }

    ticket.responses.push({
      message,
      sentBy: "user",
      senderId: userId,
      attachments,
      timestamp: new Date(),
    });

    if (ticket.status === "resolved") {
      ticket.status = "open";
    }

    await ticket.save();
    return ticket;
  }

  /**
   * Get FAQs with filters
   */
  async getFAQs(filters = {}) {
    const { category, search, page = 1, limit = 20 } = filters;

    let query = { isActive: true };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { question: { $regex: search, $options: "i" } },
        { answer: { $regex: search, $options: "i" } },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const faqs = await FAQ.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await FAQ.countDocuments(query);

    return {
      faqs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  /**
   * Get FAQ categories with counts
   */
  async getFAQCategories() {
    const categories = await FAQ.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          icon: { $first: "$icon" },
        },
      },
      {
        $project: {
          id: "$_id",
          name: "$_id",
          count: 1,
          icon: 1,
          _id: 0,
        },
      },
      { $sort: { name: 1 } },
    ]);

    return categories;
  }

  /**
   * Track FAQ helpfulness
   */
  async trackFAQHelpfulness(faqId, helpful, userId = null, userData = null) {
    const faq = await FAQ.findOne({ id: faqId });

    if (!faq) {
      throw new Error("FAQ not found");
    }

    if (helpful) {
      faq.helpful = (faq.helpful || 0) + 1;
    } else {
      faq.notHelpful = (faq.notHelpful || 0) + 1;
    }

    await faq.save();

    // Store user feedback if user is logged in
    if (userId && userData) {
      const feedback = new Support({
        type: "faq-feedback",
        userId,
        name: userData.name || "Anonymous",
        email: userData.email || "anonymous@user.com",
        faqId: parseInt(faqId),
        helpful,
        message: `User found FAQ ${helpful ? "helpful" : "not helpful"}`,
      });
      await feedback.save();
    }

    return faq;
  }

  /**
   * Get all tickets (admin)
   */
  async getAllTickets(filters = {}) {
    const { status, type, page = 1, limit = 20, search } = filters;

    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { ticketId: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tickets = await Support.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate("userId", "name email");

    const total = await Support.countDocuments(query);

    return {
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  /**
   * Update ticket status (admin)
   */
  async updateTicketStatus(ticketId, updates) {
    const ticket = await Support.findOne({ ticketId });

    if (!ticket) {
      throw new Error("Ticket not found");
    }

    if (updates.status) {
      ticket.status = updates.status;
      if (updates.status === "resolved") {
        ticket.resolvedAt = new Date();
      } else if (updates.status === "closed") {
        ticket.closedAt = new Date();
      }
    }

    if (updates.priority) ticket.priority = updates.priority;
    if (updates.assignedTo) ticket.assignedTo = updates.assignedTo;

    await ticket.save();
    return ticket;
  }

  /**
   * Get support statistics (admin)
   */
  async getStatistics() {
    const stats = await Support.aggregate([
      {
        $facet: {
          totalTickets: [{ $match: { type: "support" } }, { $count: "count" }],
          openTickets: [
            { $match: { type: "support", status: "open" } },
            { $count: "count" },
          ],
          resolvedToday: [
            {
              $match: {
                type: "support",
                resolvedAt: {
                  $gte: new Date().setHours(0, 0, 0, 0),
                },
              },
            },
            { $count: "count" },
          ],
          feedbackStats: [
            { $match: { type: "feedback", rating: { $exists: true } } },
            {
              $group: {
                _id: null,
                averageRating: { $avg: "$rating" },
                totalFeedback: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const faqStats = await FAQ.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: "$metadata.views" },
          totalHelpful: { $sum: "$helpful" },
          totalNotHelpful: { $sum: "$notHelpful" },
        },
      },
    ]);

    return {
      ...stats[0],
      faqStats: faqStats[0] || {
        totalViews: 0,
        totalHelpful: 0,
        totalNotHelpful: 0,
      },
    };
  }
}

module.exports = new SupportService();
