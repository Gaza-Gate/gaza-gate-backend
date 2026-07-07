const router = require("express").Router();
const authenticateAccessToken = require("../middlewares/auth/verifyToken.middleware.js");
const notificationController = require("../controllers/notification.controller.js");

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
router.delete(
  "/:notificationId",
  authenticateAccessToken,
  notificationController.deleteNotification,
);

module.exports = router;
