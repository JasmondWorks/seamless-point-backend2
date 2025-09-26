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

module.exports = router;
