require("dotenv").config();
require("./models/associations");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/auth.route.js");
const productRoute = require("./routes/product.route.js");
const orderRoute = require("./routes/order.route.js");
const customerOrderRoute = require("./routes/customerOrder.route.js");
const categoryRoute = require("./routes/category.route.js");
const reviewRoute = require("./routes/review.route.js");
const customerReviewRoute = require("./routes/customerReview.route.js");
const notificationRoute = require("./routes/notification.route.js");
const customerNotificationRoute = require("./routes/customerNotification.route.js");
const profileRoute = require("./routes/profile.route.js");
const customerProfileRoute = require("./routes/customerProfile.route.js");
const dashboardRoute = require("./routes/dashboard.route.js");
const customerHomeRoute = require("./routes/customerHome.route.js");
const wishlistRoute = require("./routes/wishlist.route.js");
const cartRoute = require("./routes/cart.route.js");
const aiRoute = require("./routes/ai.route.js");
const customerChatbotRoute = require("./routes/customerChatbot.route.js");
const sellerChatbotRoute = require("./routes/sellerChatbot.route.js");
const apiResponse = require("./utils/apiResponse.util.js");
const errorHandler = require("./middlewares/common/errorHandler.middleware.js");

const app = express();

app.use(
  cors({
    origin: ["https://gaza-gate-frontend.vercel.app", "http://localhost:3000"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", authRoute);
app.use("/api/product", productRoute);
app.use("/api/customer/order", customerOrderRoute);
app.use("/api/order", orderRoute);
app.use("/api/category", categoryRoute);
app.use("/api/seller/review", reviewRoute);
app.use("/api/customer/review", customerReviewRoute);
app.use("/api/seller/notification", notificationRoute);
app.use("/api/customer/notification", customerNotificationRoute);
app.use("/api/seller/profile", profileRoute);
app.use("/api/profile", customerProfileRoute);
app.use("/api/seller/dashboard", dashboardRoute);
app.use("/api/customer/home", customerHomeRoute);
app.use("/api/customer/wishlist", wishlistRoute);
app.use("/api/customer/cart", cartRoute);
app.use("/api/seller/ai", aiRoute);
app.use("/api/customer/chatbot", customerChatbotRoute);
app.use("/api/seller/chatbot", sellerChatbotRoute);

app.use((req, res, next) => {
  apiResponse.sendFail(res, { message: "Route not found!" }, 404);
});
app.use(errorHandler);

module.exports = app;
