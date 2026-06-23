const { Resend } = require('resend');
const AppError = require('../utils/AppError.util');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'Gaza Gate <onboarding@resend.dev>';

const sendEmail = async ({ to, subject, html }) => {
  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to:   [to],
    subject,
    html,
  });

  if (error) {
    console.error('Resend error:', error);
    throw new AppError(`Failed to send email: ${error.message}`, 500);
  }

  console.log(`Email sent successfully to: ${to} | ID: ${data.id}`);
  return data;
};

const sendVerificationEmail = async (toEmail, otpCode) => {
  return sendEmail({
    to:      toEmail,
    subject: 'Email Verification Code - Gaza Gate',
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
    to:      toEmail,
    subject: 'Password Reset Code - Gaza Gate',
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



/*
const { Resend } = require("resend");

const resendApiKey = process.env.RESEND_API_KEY;
if (!resendApiKey) {
  throw new Error("RESEND_API_KEY is missing from environment variables.");
}

const resend = new Resend(resendApiKey);

const isTestMode =
  String(process.env.RESEND_TEST_MODE || "").toLowerCase() === "true";

const TEST_RECIPIENT = "delivered@resend.dev";
const TEST_SENDER = "Gaza Gate <onboarding@resend.dev>";

function resolveRecipient(toEmail) {
  return isTestMode ? TEST_RECIPIENT : toEmail;
}

function resolveSender() {
  return process.env.RESEND_FROM_EMAIL || TEST_SENDER;
}

function buildEmailShell({ title, code, codeColor, description, footer }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #eee; border-radius: 14px;">
      <h2 style="color: #222; text-align: center; margin: 0 0 12px;">${title}</h2>
      <p style="font-size: 16px; line-height: 1.7; color: #555; margin: 0 0 20px;">${description}</p>

      <div style="background-color: #f8f8f8; padding: 18px; text-align: center; border-radius: 10px; margin: 22px 0;">
        <h1 style="letter-spacing: 6px; color: ${codeColor}; margin: 0; font-size: 38px; font-weight: 700;">${code}</h1>
      </div>

      <p style="font-size: 14px; color: #888; text-align: center; margin: 0;">${footer}</p>
    </div>
  `;
}

async function sendEmail({ toEmail, subject, html }) {
  const to = resolveRecipient(toEmail);
  const from = resolveSender();

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
  });

  if (error) {
    throw error;
  }

  return data;
}

const sendVerificationEmail = async (toEmail, otpCode) => {
  try {
    const html = buildEmailShell({
      title: "Your Verification Code",
      code: otpCode,
      codeColor: "#4CAF50",
      description:
        "Use this code to verify your email and complete your registration on Gaza Gate.",
      footer: "This code expires in 10 minutes.",
    });

    const result = await sendEmail({
      toEmail,
      subject: "Email Verification Code - Gaza Gate",
      html,
    });

    console.log(
      `Verification email sent successfully to: ${isTestMode ? TEST_RECIPIENT : toEmail}`
    );
    return result;
  } catch (error) {
    console.error(`Failed to send verification email to ${toEmail}:`, error);
    throw error;
  }
};

const sendPasswordResetEmail = async (toEmail, resetCode) => {
  try {
    const html = buildEmailShell({
      title: "Password Reset Request",
      code: resetCode,
      codeColor: "#E53935",
      description:
        "We received a request to reset your password. Use the code below to continue.",
      footer:
        "This code expires in 10 minutes. If you did not request this, you can safely ignore this email.",
    });

    const result = await sendEmail({
      toEmail,
      subject: "Password Reset Code - Gaza Gate",
      html,
    });

    console.log(
      `Password reset email sent successfully to: ${isTestMode ? TEST_RECIPIENT : toEmail}`
    );
    return result;
  } catch (error) {
    console.error(`Failed to send password reset email to ${toEmail}:`, error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};

*/













/*
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
      host: "smtp.gmail.com",
      port: 587,
      secure: false,

      auth: {
        type: "OAuth2",
        user: process.env.EMAIL_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
        accessToken: accessToken,
      },
      tls: {
        rejectUnauthorized: false,
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
*/