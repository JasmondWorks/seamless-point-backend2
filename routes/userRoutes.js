const express = require("express");
const authController = require("../controllers/authController");
const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");
const deliveryController = require("../controllers/deliveryController");

const router = express.Router();

router.post("/login", authController.userLogin);

router.post("/signup", authController.userSignUp);

router.post("/signIn", authController.userSignIn);

router.post("/forgotPassword", authController.forgotUserPassword);

router.patch("/resetPassword", authController.resetUserPassword);

router.get("/authenticate", authController.authenticateUser);

router.patch(
  "/updateMyPassword",
  authController.authenticate,
  authController.authorize("user"),
  authController.updateMyPassword
);

router
  .route("/me")
  .get(
    authController.authenticate,
    authController.authorize("user"),
    userController.Me
  )
  .patch(
    authController.authenticate,
    authController.authorize("user"),
    userController.updateMe
  )
  .delete(
    authController.authenticate,
    authController.authorize("user"),
    userController.deleteMe
  );

router.get(
  "/me/delivery",
  authController.authenticate,
  authController.authorize("user"),
  userController.getMyDelivery
);

router.get(
  "/me/transactions",
  authController.authenticate,
  authController.authorize("user"),
  userController.getMyTransactions
);

router.get(
  "/me/notifications",
  authController.authenticate,
  authController.authorize("user"),
  userController.getMyNotifications
);

// router.get(
//   "/me/transactions",
//   authController.authenticate,
//   authController.authorize("user"),
//   notificationController.getMyTransactions
// );

router.get(
  "/:id/delivery",
  authController.authenticate,
  authController.authorize("admin"),
  userController.getUserDelivery
);

router.get(
  "/:id/notifications",
  authController.authenticate,
  authController.authorize("admin"),
  userController.getUserNotifications
);

// Transactions
// router.get("/:id/transactions", () => {});

router.get(
  "/",
  authController.authenticate,
  authController.authorize("admin"),
  userController.getAllUser
);
router
  .route("/latest")
  .get(
    authController.authenticate,
    authController.authorize("admin"),
    userController.alistLatestUsers,
    userController.getAllUser
  );

module.exports = router;
