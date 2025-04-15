const express = require("express");
const { getTrackingInfo } = require("../controllers/trackingController");

const router = express.Router();

router.get("/track", getTrackingInfo);

module.exports = router;
