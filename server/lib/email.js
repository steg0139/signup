const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send an email to the admin.
 * @param {string} subject
 * @param {string} text - plain text body
 */
async function sendAdminEmail(subject, text) {
  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: `"Hoops Signup" <${process.env.GMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject,
    text,
  });
  console.log('Email sent:', info.messageId);
  return info;
}

module.exports = { sendAdminEmail };
