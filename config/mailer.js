const { Resend } = require("resend");

const apiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.RESEND_FROM || "TIMEZONE Watches <onboarding@resend.dev>";

if (!apiKey) {
  throw new Error("RESEND_API_KEY is missing in .env");
}

const resend = new Resend(apiKey);

const transporter = {
  async verify() {
    if (!apiKey) {
      throw new Error("Resend API key is missing");
    }

    return true;
  },

  async sendMail(mailOptions) {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      text: mailOptions.text,
    });

    if (error) {
      console.error("Resend email error:", error);
      throw new Error(error.message || "Email sending failed");
    }

    console.log("Email sent successfully:", data.id);

    return {
      messageId: data.id,
      response: "Email sent successfully",
    };
  },
};

module.exports = transporter;