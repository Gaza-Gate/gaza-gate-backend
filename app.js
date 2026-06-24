require("dotenv").config();
require("./models/associations");
const express = require("express");
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/auth.route.js");
const apiResponse = require("./utils/apiResponse.util.js");
const errorHandler = require("./middlewares/common/errorHandler.middleware.js");

const app = express();

app.use(cors({
    origin: [
        "https://gaza-gate-frontend.vercel.app", 
        "http://localhost:3000"
    ],
    credentials: true
}));

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, 'access.log'), 
  { flags: 'a' }
);


app.use(morgan('combined', { stream: accessLogStream }));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoute);

app.use((req, res, next) => {
  apiResponse.sendFail(
    res,
    { message: "Route not found!" },
    404
  );
});
app.use(errorHandler);

module.exports = app;
