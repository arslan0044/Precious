import nodemailer from "nodemailer";
import config from "../config/env.js";

const transporter = nodemailer.createTransport({
  //   host: config.get("smtp.host"),
  //   port: config.get("smtp.port"),
  //   secure: config.get("smtp.secure"), // true for 465, false for 587
  service: "Gmail",
  auth: {
    user: config.get("email.user"),
    pass: config.get("email.pass"),
  },
});

export async function sendEmail({ to, subject, text, html }) {
  const mailOptions = {
    from: config.get("email.user"), // "Your App <noreply@yourdomain.com>"
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email sending failed:", err);
    return { success: false, error: err.message };
  }
}
