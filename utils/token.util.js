const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  PENDING_TOKEN_EXPIRES_IN,
} = require("../constants/auth.constant.js");

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.REFRESH_SECRET_KEY, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function signPendingToken(payload) {
  return jwt.sign(payload, process.env.PENDING_SECRET_KEY, {
    expiresIn: PENDING_TOKEN_EXPIRES_IN,
  });
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET_KEY);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_SECRET_KEY);
};

const verifyPendingToken = (token) => {
  return jwt.verify(token, process.env.PENDING_SECRET_KEY);
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  signPendingToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyPendingToken,
};
