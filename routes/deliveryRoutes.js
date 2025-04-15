const express = require("express");
const deliveryController = require("../controllers/deliveryController");
const authController = require("../controllers/authController");
const router = express.Router();

router
  .route("/")
  .get(
    authController.authenticate,
    authController.authorize("admin"),
    deliveryController.getAllDelivery
  )
  .post(
    authController.authenticate,
    authController.authorize("user"),
    deliveryController.createDelivery
  );
router
  .route("/user")
  .get(
    authController.authenticate,
    authController.authorize("user"),
    deliveryController.getAllUserDelivery
  );
router
  .route("/latest")
  .get(
    authController.authenticate,
    authController.authorize("admin", "user"),
    deliveryController.aliasLatestDeliveries,
    deliveryController.getAllDelivery
  );
router
  .route("/:id")
  .get(
    authController.authenticate,
    authController.authorize("admin", "user"),
    deliveryController.getDelivery
  )
  .patch(
    authController.authenticate,
    authController.authorize("admin", "user"),
    deliveryController.updateDelivery
  )
  .delete(
    authController.authenticate,
    authController.authorize("admin", "user"),
    deliveryController.deleteDelivery
  );

router.patch(
  "/:id/assignDriver",
  authController.authenticate,
  authController.authorize("admin"),
  deliveryController.assignDriver
);

router.patch(
  "/:id/complete",
  authController.authenticate,
  authController.authorize("admin"),
  deliveryController.completed
);

router.patch(
  "/:id/cancel",
  authController.authenticate,
  authController.authorize("admin", "user"),
  deliveryController.cancelled
);

module.exports = router;
