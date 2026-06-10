const jwt = require("jsonwebtoken");
const {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  PENDING_TOKEN_EXPIRES_IN,
} = require("../constants/auth.constant.js");

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

function signPendingToken(payload) {
  return jwt.sign(payload, process.env.PENDING_SECRET_KEY, {
    expiresIn: PENDING_TOKEN_EXPIRES_IN,
  });
}

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
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
