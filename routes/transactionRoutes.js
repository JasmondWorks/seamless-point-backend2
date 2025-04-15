const express = require("express");
const {
  initializeTransaction,
  verifyTransaction,
  webhook,
  createTransaction,
} = require("../controllers/transactionController");
const authController = require("../controllers/authController");
const router = express.Router();

router.post(
  "/paystack/initialize",
  authController.authenticate,
  authController.authorize("user"),
  initializeTransaction
);
router.get(
  "/paystack/verify",
  authController.authenticate,
  authController.authorize("user"),
  verifyTransaction
);
router.get(
  "/webhook",
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
  webhook
);
router.post(
  "/create",
  authController.authenticate,
  authController.authorize("user"),
  createTransaction
);

module.exports = router;
