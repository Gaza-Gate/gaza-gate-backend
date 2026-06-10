const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

module.exports = refreshTokenCookieOptions;
