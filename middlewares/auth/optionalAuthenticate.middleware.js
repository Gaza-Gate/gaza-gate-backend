const authenticateAccessToken = require("./verifyToken.middleware.js");

const optionalAuthenticateAccessToken = (req, res, next) => {
  if (req.headers.authorization === undefined) {
    return next();
  }

  return authenticateAccessToken(req, res, next);
};

module.exports = optionalAuthenticateAccessToken;
