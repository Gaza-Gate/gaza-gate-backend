require("dotenv").config();
require("./models/associations");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoute = require("./routes/shared/auth.route.js");
const productRoute = require("./routes/shared/product.route.js");
const orderRoute = require("./routes/seller/order.route.js");
const customerOrderRoute = require("./routes/customer/customerOrder.route.js");
const categoryRoute = require("./routes/shared/category.route.js");
const reviewRoute = require("./routes/seller/review.route.js");
const customerReviewRoute = require("./routes/customer/customerReview.route.js");
const notificationRoute = require("./routes/shared/notification.route.js");
const customerNotificationRoute = require("./routes/customer/customerNotification.route.js");
const profileRoute = require("./routes/seller/profile.route.js");
const customerProfileRoute = require("./routes/customer/customerProfile.route.js");
const dashboardRoute = require("./routes/seller/dashboard.route.js");
const customerHomeRoute = require("./routes/customer/customerHome.route.js");
const wishlistRoute = require("./routes/customer/wishlist.route.js");
const cartRoute = require("./routes/customer/cart.route.js");
const aiRoute = require("./routes/seller/ai.route.js");
const customerChatbotRoute = require("./routes/customer/customerChatbot.route.js");
const sellerChatbotRoute = require("./routes/seller/sellerChatbot.route.js");
const conversationRoute = require("./routes/shared/conversation.route.js");
const apiResponse = require("./utils/http/apiResponse.util.js");
const errorHandler = require("./middlewares/common/errorHandler.middleware.js");
const adminCategoryRoute = require("./routes/admin/category.route.js");
const adminUserRoute = require("./routes/admin/user.route.js");
const adminProductRoute = require("./routes/admin/product.route.js");
const adminDashboardRoute = require("./routes/admin/dashboard.route.js");
const sellerStoreRoute = require("./routes/customer/sellerStore.route.js");
const sharedReviewRoute = require("./routes/shared/review.route.js");
const landingRoute = require("./routes/shared/landing.route.js");

const app = express();

app.use(
  cors({
    origin: ["https://gaza-gate-frontend.vercel.app","https://gaza-gate-frontend-git-development-aya-sehwils-projects.vercel.app","https://gazagate.store", "http://localhost:3000"],
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
app.use("/api/review", sharedReviewRoute);
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
app.use("/api/conversations", conversationRoute);
app.use("/api/admin/category", adminCategoryRoute);
app.use("/api/admin/user", adminUserRoute);
app.use("/api/admin/product", adminProductRoute);
app.use("/api/admin/dashboard", adminDashboardRoute);
app.use("/api/customer/store", sellerStoreRoute);
app.use("/api/landing", landingRoute);

app.use((req, res, next) => {
  apiResponse.sendFail(res, { message: "Route not found!" }, 404);
});
app.use(errorHandler);

module.exports = app;

