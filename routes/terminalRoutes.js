// routes/createAddress.js

const express = require("express");
const terminalController = require("../controllers/terminalController");
const authController = require("../controllers/authController");
const router = express.Router();

router.post(
  "/addresses",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.createAddress
);
router.post(
  "/addresses/validate",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.validateAddress
);

router.get(
  "/countries",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getCountries
);
router.get(
  "/states",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getStates
);
router.get(
  "/cities",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getCities
);
router.get(
  "/hs-codes/search",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.searchHsCode
);
router.post(
  "/rates",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getRates
);
router.get(
  "/rates/:id",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getRate
);

router.post(
  "/shipments",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.createShipment
);
router.get(
  "/shipments/:id",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getShipment
);
router.get(
  "/shipments/track/:shipmentId",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.trackShipment
);
router.post(
  "/shipments/cancel",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.cancelShipment
);

router.post(
  "/shipments/pickup",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.arrangeShipmentPickup
);

router.get(
  "/categories",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getCategories
);
router.get(
  "/:category/sub-categories",
  authController.authenticate,
  authController.authorize("user"),
  terminalController.getSubCategories
);

module.exports = router;
