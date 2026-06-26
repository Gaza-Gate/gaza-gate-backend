require("dotenv").config();
require("./models/associations");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/auth.route.js");
const productRoute = require("./routes/product.route.js");
const orderRoute = require("./routes/order.route.js");
const apiResponse = require("./utils/apiResponse.util.js");
const errorHandler = require("./middlewares/common/errorHandler.middleware.js");
const sellerRoute=require("./routes/seller.route.js")

const app = express();

app.use(cors({
    origin: [
        "https://gaza-gate-frontend.vercel.app", 
        "http://localhost:3000"
    ],
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/product", productRoute);
app.use("/api/order", orderRoute);
app.use("/api/seller/review",reviewRoute)
app.use("/api/seller/notification",notificationRoute)

app.use((req, res, next) => {
  apiResponse.sendFail(
    res,
    { message: "Route not found!" },
    404
  );
});
app.use(errorHandler);

module.exports = app;
