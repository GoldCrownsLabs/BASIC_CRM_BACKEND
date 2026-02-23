const nodemailer = require("nodemailer");
require("dotenv").config();

// ============ BREVO CONFIGURATION (Real Emails) ============

// 🔵 Brevo Configuration - यही हमारा real email provider है
const BREVO_CONFIG = {
  host: process.env.BREVO_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.BREVO_PORT) || 587,
  secure: process.env.BREVO_SECURE === "true" || false,
  user: process.env.BREVO_USER || "a31b67001@smtp-brevo.com",
  pass: process.env.BREVO_PASSWORD,
  from: process.env.BREVO_FROM || '"Avinash" <avinash@goldcrownlabs.com>',
};

// ============ BREVO TRANSPORTER ============

// 🔵 Create Brevo Transporter (Real Emails)
const createBrevoTransporter = () => {
  // Password check
  if (!BREVO_CONFIG.pass) {
    console.error("❌ BREVO_PASSWORD not found in .env file!");
    console.log("⚠️ Please add BREVO_PASSWORD to your .env file");
    throw new Error("Brevo password not configured");
  }

  return nodemailer.createTransport({
    host: BREVO_CONFIG.host,
    port: BREVO_CONFIG.port,
    secure: BREVO_CONFIG.secure,
    auth: {
      user: BREVO_CONFIG.user,
      pass: BREVO_CONFIG.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// ============ CONNECTION TEST ============

// 🔵 Test Brevo connection
const testBrevoConnection = async () => {
  try {
    const transporter = createBrevoTransporter();
    await transporter.verify();
    console.log("✅ Brevo (Real Email) connected successfully!");
    console.log("📧 Using:", BREVO_CONFIG.user);
    console.log("📊 Free limit: 300 emails/day");
    console.log("✅ Ready to send real emails!");
    return true;
  } catch (error) {
    console.error("❌ Brevo connection failed:", error.message);
    console.log("\n🔧 Troubleshooting tips:");
    console.log("1. Check if BREVO_PASSWORD is correct in .env file");
    console.log("2. Verify your Brevo account is active");
    console.log("3. Check your internet connection");
    return false;
  }
};

// ============ MAIN SEND FUNCTION ============

/**
 * Send real email via Brevo
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.from - From address (optional)
 */
const sendEmail = async ({ to, subject, html, from = null }) => {
  try {
    const transporter = createBrevoTransporter();
    const fromAddress = from || BREVO_CONFIG.from;

    const mailOptions = {
      from: fromAddress,
      to: to,
      subject: subject,
      html: html,
      text: html.replace(/<[^>]*>/g, ""),
    };

    console.log(`📨 Sending real email to:`, to);
    console.log(`📧 From:`, fromAddress);

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent via Brevo! Message ID:`, info.messageId);
    console.log(`📊 Daily remaining: ${300 - 1}/300`);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      provider: "Brevo",
      to: to,
      from: fromAddress, // ✅ from भी return करो
    };
  } catch (error) {
    console.error(`❌ Email send error:`, error.message);
    throw error;
  }
};

// ============ TEMPLATE FUNCTIONS ============

// ✅ FIXED: Send email with template variables (from parameter add किया)
const sendTemplateEmail = async ({
  to,
  subject,
  template,
  variables,
  from = null,
}) => {
  const processedSubject = replaceVariables(subject, variables);
  const processedHtml = replaceVariables(template, variables);

  return await sendEmail({
    to,
    subject: processedSubject,
    html: processedHtml,
    from: from || BREVO_CONFIG.from, // ✅ from पास करो
  });
};

// ✅ FIXED: Send bulk emails (options parameter add किया)
const sendBulkEmails = async (recipients, subject, template, options = {}) => {
  const { from = BREVO_CONFIG.from } = options; // ✅ options से from निकालो

  const results = {
    total: recipients.length,
    successful: [],
    failed: [],
    provider: "Brevo",
  };

  console.log(`\n🚀 Sending ${recipients.length} real emails via Brevo...`);
  console.log(
    `📊 Daily limit: 300 emails (${300 - recipients.length} will remain)`,
  );

  for (const recipient of recipients) {
    try {
      const variables = {
        name: recipient.name || "Valued Customer",
        email: recipient.email,
        ...recipient.variables,
      };

      const result = await sendTemplateEmail({
        to: recipient.email,
        subject: subject,
        template: template,
        variables: variables,
        from: from, // ✅ from पास करो
      });

      results.successful.push({
        email: recipient.email,
        name: recipient.name,
        messageId: result.messageId,
        from: result.from, // ✅ from भी store करो
      });

      console.log(`✅ Sent to ${recipient.email}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`❌ Failed for ${recipient.email}:`, error.message);
      results.failed.push({
        email: recipient.email,
        name: recipient.name,
        error: error.message,
      });
    }
  }

  console.log(
    `\n📊 Summary: ${results.successful.length} sent, ${results.failed.length} failed`,
  );
  return results;
};

// ============ TEST FUNCTIONS ============

// Send test email via Brevo
const sendTestEmail = async () => {
  console.log(`🚀 Sending test email via Brevo...`);

  const testData = {
    to: "avinashkumarpandey@gmail.com", // ✅ अपना real email डालो
    subject: "Test Email from CRM",
    template: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; }
          .header { background: #4CAF50; color: white; padding: 10px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Test Email</h1>
          </div>
          <div class="content">
            <p>Hello {name},</p>
            <p>This is a test email from your CRM system.</p>
            <p>Your email: {email}</p>
            <p>Sent via: <strong>Brevo (Real Email)</strong></p>
            <p>From: <strong>avinash@goldcrownlabs.com</strong></p>
            <p>Best regards,<br>CRM Team</p>
          </div>
        </div>
      </body>
      </html>
    `,
    variables: {
      name: "Avinash",
      email: "avinash@goldcrownlabs.com",
    },
  };

  try {
    const result = await sendTemplateEmail({
      to: testData.to,
      subject: testData.subject,
      template: testData.template,
      variables: testData.variables,
      from: BREVO_CONFIG.from, // ✅ from पास करो
    });

    console.log("\n✅ Test email sent successfully!");
    console.log("📧 From:", result.from);
    console.log("📨 To:", testData.to);
    console.log("📊 Daily limit: 300 emails");
    return result;
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
};

// ============ HELPER FUNCTIONS ============

// Helper: Replace variables in text
const replaceVariables = (text, variables) => {
  if (!text) return text;

  return text.replace(/\{([^}]+)\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];

    if (value === undefined || value === null) {
      console.warn(`⚠️ Variable "${trimmedKey}" not found in data`);
      return match;
    }

    return value;
  });
};

// ============ AUTO-TEST ON STARTUP ============
console.log("🔌 Initializing Brevo email service...\n");
testBrevoConnection();

// ============ EXPORTS ============
module.exports = {
  sendEmail,
  sendTemplateEmail,
  sendBulkEmails,
  testBrevoConnection,
  sendTestEmail,
};
