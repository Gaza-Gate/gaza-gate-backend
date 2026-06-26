const router=require("express").Router();
const isauthenticated=require("../middlewares/auth/verifyToken.middleware");
const notificationController=require("../controllers/notification.controller");

router.get("/",isauthenticated,notificationController.getNotifications)

router.patch("/read-all",isauthenticated,notificationController.markAllAsRead)

router.patch("/:notificationId/read",isauthenticated,notificationController.markAsRead)

router.delete("/",isauthenticated,notificationController.deleteAllNotifications)

module.exports=router;
