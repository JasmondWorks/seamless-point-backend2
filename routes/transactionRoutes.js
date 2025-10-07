const express = require("express");
const {
  initializeTransaction,
  verifyTransaction,
  webhook,
  createTransaction,
  createVirtualAccount,
  deleteVirtualAccount,
  getVirtualAccount,
  getBanksList,
  getAccountDetails,
  withdrawFunds,
  getBankProviders,
  getCustomer,
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
router.get(
  "/virtual-account",
  authController.authenticate,
  authController.authorize("user"),
  getVirtualAccount
);
router.post(
  "/virtual-account",
  authController.authenticate,
  authController.authorize("user"),
  createVirtualAccount
);
router.get(
  "/customer",
  authController.authenticate,
  authController.authorize("user"),
  getCustomer
);
router.get(
  "/bank-providers",
  authController.authenticate,
  authController.authorize("user"),
  getBankProviders
);
router.get(
  "/monnify/virtual-account",
  authController.authenticate,
  authController.authorize("user"),
  getVirtualAccount
);
router.delete(
  "/monnify/virtual-account",
  authController.authenticate,
  authController.authorize("user"),
  deleteVirtualAccount
);
router.post(
  "/withdraw",
  authController.authenticate,
  authController.authorize("user"),
  withdrawFunds
);
// router.post(
//   "/webhook",
//   (req, res, next) => {
//     const chunks = [];
//     req.on("data", (chunk) => {
//       chunks.push(chunk);
//     });
//     req.on("end", () => {
//       req.rawBody = Buffer.concat(chunks);
//       req.body = JSON.parse(req.rawBody.toString());
//       next();
//     });
//   },
//   webhook
// );
router.post(
  "/create",
  authController.authenticate,
  authController.authorize("user"),
  createTransaction
);

module.exports = router;
