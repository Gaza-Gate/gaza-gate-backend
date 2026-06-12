const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleTokenVerifier = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return next(AppError.fail("Google token is required", 400));
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    req.googlePayload = ticket.getPayload();

    next();
  } catch (error) {
    return next(AppError.fail("Invalid or expired Google token", 401));
  }
};

module.exports = googleTokenVerifier;
