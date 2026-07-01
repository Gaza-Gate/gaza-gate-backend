const router = require("express").Router();
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware");
const notificationController = require("../controllers/notification.controller");

router.get(
  "/",
  authenticateAccessToken,
  notificationController.getNotifications,
);

router.patch(
  "/read-all",
  authenticateAccessToken,
  notificationController.markAllAsRead,
);

router.patch(
  "/:notificationId/read",
  authenticateAccessToken,
  notificationController.markAsRead,
);

router.delete(
  "/",
  authenticateAccessToken,
  notificationController.deleteAllNotifications,
);

module.exports = router;
