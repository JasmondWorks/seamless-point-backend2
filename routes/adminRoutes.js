const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/login", authController.adminLogin);

router.post(
  "/signup",
  authController.authenticate,
  authController.authorizeRootAdmin,
  authController.adminSignUp
);

router.post("/signIn", authController.adminSignIn);

router.post("/forgotPassword", authController.forgotAdminPassword);

router.patch("/resetPassword", authController.resetAdminPassword);

router.get("/authenticate", authController.authenicateAdmin);

router.patch(
  "/updateMyPassword",
  authController.authenticate,
  authController.authorize("admin"),
  authController.updateMyPassword
);

module.exports = router;
