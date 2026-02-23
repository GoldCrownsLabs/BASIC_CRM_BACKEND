// You can use Twilio, WhatsApp Business API, or any other provider
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

const sendWhatsApp = async ({ to, message }) => {
  try {
    const response = await client.messages.create({
      body: message,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${to}`,
    });

    console.log("WhatsApp sent:", response.sid);
    return response;
  } catch (error) {
    console.error("WhatsApp send error:", error);
    throw error;
  }
};

module.exports = { sendWhatsApp };
