const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

module.exports = refreshTokenCookieOptions;
