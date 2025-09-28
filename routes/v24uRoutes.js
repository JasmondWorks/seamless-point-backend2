const express = require("express");
const v24uController = require("../controllers/v24uController");
const authController = require("../controllers/authController");

const router = express.Router();

router.get(
  "/data/bundles",
  authController.authenticate,
  v24uController.getDataBundles
);
router.post(
  "/data/buy",
  authController.authenticate,
  v24uController.buyDataBundle
);
router.post(
  "/topupAirtime",
  authController.authenticate,
  v24uController.topUpAirtime
);
router.get("/tv/plans", authController.authenticate, v24uController.getTvPlans);
router.post(
  "/tv/card/verify",
  authController.authenticate,
  v24uController.verifyTvCardNumber
);
router.post(
  "/tv/subscribe",
  authController.authenticate,
  v24uController.buyTvPlan
);

router.post(
  "/electricity/recipient/verify",
  authController.authenticate,
  v24uController.verifyElectricityRecipient
);
router.post(
  "/electricity/purchase",
  authController.authenticate,
  v24uController.buyElectricity
);

module.exports = router;
