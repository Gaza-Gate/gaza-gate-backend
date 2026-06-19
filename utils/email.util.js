const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (toEmail, otpCode) => {
  await transporter.sendMail({
    from: `"Marketplace" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Email Verification Code",
    html: `
      <h2>Your Verification Code</h2>
      <p>Use this code to verify your email:</p>
      <h1 style="letter-spacing: 5px;">${otpCode}</h1>
      <p>This code expires in 10 minutes.</p>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, resetCode) => {
  await transporter.sendMail({
    from: `"Marketplace" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Password Reset Code",
    html: `
      <h2>Password Reset Request</h2>
      <p>Use this code to reset your password:</p>
      <h1 style="letter-spacing: 5px;">${resetCode}</h1>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });
};

module.exports = { 
  sendVerificationEmail,
  sendPasswordResetEmail
};
