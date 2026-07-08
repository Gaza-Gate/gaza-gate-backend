const nodemailer = require("nodemailer");

const AppError = require("../utils/AppError.util");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_ADDRESS = process.env.EMAIL_FROM;

const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to,
      subject,
      html,
    });

    console.log(
      `Email sent successfully to: ${to} | Message ID: ${info.messageId}`
    );

    return info;
  } catch (error) {
    console.error("Nodemailer error:", error);

    throw new AppError(`Failed to send email: ${error.message}`, 500);
  }
};

const sendVerificationEmail = async (toEmail, otpCode) => {
  return sendEmail({
    to: toEmail,
    subject: "Email Verification Code - Gaza Gate",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Your Verification Code</h2>

        <p style="font-size: 16px; color: #555;">
          Use this code to verify your email and complete your registration on Gaza Gate platform:
        </p>

        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="letter-spacing: 5px; color: #4CAF50; margin: 0; font-size: 36px;">
            ${otpCode}
          </h1>
        </div>

        <p style="font-size: 14px; color: #999; text-align: center;">
          This code expires in 10 minutes.
        </p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (toEmail, resetCode) => {
  return sendEmail({
    to: toEmail,
    subject: "Password Reset Code - Gaza Gate",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #333; text-align: center;">Password Reset Request</h2>

        <p style="font-size: 16px; color: #555;">
          We received a request to reset your password. Use the following code to proceed:
        </p>

        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <h1 style="letter-spacing: 5px; color: #E53935; margin: 0; font-size: 36px;">
            ${resetCode}
          </h1>
        </div>

        <p style="font-size: 14px; color: #999; text-align: center;">
          This code expires in 10 minutes.
        </p>

        <p style="font-size: 12px; color: #bbb; text-align: center; margin-top: 20px;">
          If you did not request this, please ignore this email securely.
        </p>
      </div>
    `,
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
