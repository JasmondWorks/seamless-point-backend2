const express = require("express");
const { shippoWebhook } = require("../controllers/webhookController");

const router = express.Router();

router.post("/webhook", shippoWebhook);

module.exports = router;
