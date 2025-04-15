const express = require("express");
const {
  calculateRates,
  buyShippingLabel,
} = require("../controllers/shipmentController");

const router = express.Router();

router.post("/rates", calculateRates);
router.post("/buy-label", buyShippingLabel);

module.exports = router;
