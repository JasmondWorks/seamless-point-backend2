const authController = require("../controllers/authController");
const notificationController = require("../controllers/notificationController");

const router = require("express").Router();

router.get(
  "/",
  authController.authenticate,
  authController.authorize("admin"),
  notificationController.getAllNotifications
);

router.get(
  "/user",
  authController.authenticate,
  authController.authorize("user"),
  notificationController.getUserNotifications
);
router.delete(
  "/user",
  authController.authenticate,
  authController.authorize("user"),
  notificationController.deleteUserNotifications
);
router.patch(
  "/user/markAsRead",
  authController.authenticate,
  authController.authorize("user"),
  notificationController.readNotifications
);
router
  .route("/:id")
  .get(
    authController.authenticate,
    authController.authorize("admin", "user"),
    notificationController.getNotification
  )
  .patch(
    authController.authenticate,
    authController.authorize("admin", "user"),
    notificationController.updateNotification
  )
  .delete(
    authController.authenticate,
    authController.authorize("admin"),
    notificationController.deleteNotification
  );

module.exports = router;
