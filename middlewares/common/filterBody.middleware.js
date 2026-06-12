const filterBody = (allowedFields) => {
  return (req, res, next) => {
    if (!req.body) req.body = {};

    const filterd = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        filterd[key] = req.body[key];
      }
    }

    req.body = filterd;
    next();
  };
};

module.exports = filterBody;
