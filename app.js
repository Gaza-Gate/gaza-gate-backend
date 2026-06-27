require("dotenv").config();
require("./models/associations");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/auth.route.js");
const apiResponse = require("./utils/apiResponse.util.js");
const errorHandler = require("./middlewares/common/errorHandler.middleware.js");
const sellerRoute=require("./routes/seller.route.js")
const reviewRoute=require("./routes/review.route.js")
const notificationRoute=require("./routes/notification.route.js")
const profileRoute=require("./routes/profile.route.js")
const dashboardRoute=require("./routes/dashboard.route.js")

const app = express();

app.use(cors({
  origin: "https://gaza-gate-frontend.vercel.app",
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/seller/review",reviewRoute)
app.use("/api/seller/notification",notificationRoute)
app.use("/api/seller/profile",profileRoute)
app.use("/api/seller/dashboard",dashboardRoute)


app.use((req, res, next) => {
  apiResponse.sendFail(
    res,
    { message: "Route not found!" },
    404
  );
});
app.use(errorHandler);

module.exports = app;
