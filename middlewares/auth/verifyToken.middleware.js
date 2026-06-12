const jwt = require("jsonwebtoken");
const tokens = require("../utils/tokens.js");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  
  if(!authHeader || !authHeader.startsWith("Bearer ")){
    apiResponse.sendFail(
      res,
      data: { message: "Unauthorized" },
      401
    );
  }
  
  const token = authHeader.split(" ")[1];
  
  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    req.user = decoded;
  }
  catch(error){
    apiResponse.sendFail(
      res,
      data: { message: "Unauthorized" },
      401
    );
  }
  
  next();
};

module.exports = verifyToken;