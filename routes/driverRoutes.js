const express = require("express");
const driverController = require("../controllers/driverController");
const authController = require("../controllers/authController");
const router = express.Router();

router
  .route("/")
  .get(
    authController.authenticate,
    authController.authorize("admin"),
    driverController.getAllDrivers
  )
  .post(
    authController.authenticate,
    authController.authorize("admin"),
    authController.authorizeRootAdmin,
    driverController.createDriver
  );

router
  .route("/:id")
  .get(
    authController.authenticate,
    authController.authorize("admin"),
    driverController.getDriver
  )
  .patch(
    authController.authenticate,
    authController.authorize("admin", "user"),
    driverController.updateDriver
  )
  .delete(
    authController.authenticate,
    authController.authorizeRootAdmin,
    driverController.deleteDriver
  );
module.exports = router;
