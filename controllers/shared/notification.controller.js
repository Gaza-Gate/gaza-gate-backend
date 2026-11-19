const notificationService = require("../../services/notification/notification.service.js");
const apiResponse = require("../../utils/http/apiResponse.util.js");
const asyncWrapper = require("../../utils/http/asyncWrapper.util.js");

const getNotifications = asyncWrapper(async (req, res) => {
  const data = await notificationService.getNotifications(
    req.user.id,
    req.query,
  );
  return apiResponse.sendSuccess(res, data, 200);
});

const markAsRead = asyncWrapper(async (req, res) => {
  const data = await notificationService.markAsRead(
    req.user.id,
    req.params.notificationId,
  );
  return apiResponse.sendSuccess(res, { data }, 200);
});

const markAllAsRead = asyncWrapper(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user.id);
  return apiResponse.sendSuccess(res, { data }, 200);
});

const deleteAllNotifications = asyncWrapper(async (req, res) => {
  const data = await notificationService.deleteAllNotifications(req.user.id);
  return apiResponse.sendSuccess(res, { data }, 200);
});

const deleteNotification = asyncWrapper(async (req, res) => {
  const data = await notificationService.deleteNotification(
    req.user.id,
    req.params.notificationId,
  );
  return apiResponse.sendSuccess(res, { data }, 200);
});

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteAllNotifications,
  deleteNotification,
};
