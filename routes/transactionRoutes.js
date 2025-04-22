const express = require("express");
const {
  initializeTransaction,
  verifyTransaction,
  webhook,
  createTransaction,
  createVirtualAccount,
  getBanksList,
  getAccountDetails,
  withdrawFunds,
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
  "/paystack/list-banks",
  authController.authenticate,
  authController.authorize("user"),
  getBanksList
);
router.post(
  "/paystack/account-details",
  authController.authenticate,
  authController.authorize("user"),
  getAccountDetails
);
router.post(
  "/paystack/virtual-account",
  authController.authenticate,
  authController.authorize("user"),
  createVirtualAccount
);
router.post(
  "/withdraw",
  authController.authenticate,
  authController.authorize("user"),
  withdrawFunds
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
