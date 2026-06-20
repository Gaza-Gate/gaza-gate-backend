const nodemailer = require("nodemailer");
const { google } = require("googleapis");

const myOAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

myOAuth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const createTransporter = async () => {
  try {
    const accessTokenResponse = await myOAuth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });
  } catch (error) {
    console.error("Error initializing email transporter:", error);
    throw error;
  }
};

const sendVerificationEmail = async (toEmail, otpCode) => {
  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"Gaza Gate" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Email Verification Code - Gaza Gate",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Your Verification Code</h2>
          <p style="font-size: 16px; color: #555;">Use this code to verify your email and complete your registration on Gaza Gate platform:</p>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; color: #4CAF50; margin: 0; font-size: 36px;">${otpCode}</h1>
          </div>
          <p style="font-size: 14px; color: #999; text-align: center;">This code expires in 10 minutes.</p>
        </div>
      `,
    });
    console.log(`Verification code sent successfully to: ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send verification code to ${toEmail}:`, error);
    throw error;
  }
};

const sendPasswordResetEmail = async (toEmail, resetCode) => {
  try {
    const transporter = await createTransporter();
    await transporter.sendMail({
      from: `"Gaza Gate" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: "Password Reset Code - Gaza Gate",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Password Reset Request</h2>
          <p style="font-size: 16px; color: #555;">We received a request to reset your password. Use the following code to proceed:</p>
          <div style="background-color: #f9f9f9; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <h1 style="letter-spacing: 5px; color: #E53935; margin: 0; font-size: 36px;">${resetCode}</h1>
          </div>
          <p style="font-size: 14px; color: #999; text-align: center;">This code expires in 10 minutes.</p>
          <p style="font-size: 12px; color: #bbb; text-align: center; margin-top: 20px;">If you did not request this, please ignore this email securely.</p>
        </div>
      `,
    });
    console.log(`Password reset code sent successfully to: ${toEmail}`);
  } catch (error) {
    console.error(`Failed to send password reset code to ${toEmail}:`, error);
    throw error;
  }
};

module.exports = { 
  sendVerificationEmail,
  sendPasswordResetEmail
};