const crypto = require("crypto");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const AppError = require("../utils/appError");
const Notifications = require("../models/notificationModel");

module.exports.createTransaction = catchAsync(async (req, res, next) => {
  const { amount, type, reference } = req.body;
  const remark = req.body?.remark || "";
  let message = remark || "You just made a transaction";

  console.log(amount, type, remark);

  if (!amount || isNaN(amount) || amount <= 0) {
    return next(new AppError("Amount must be a positive number", 400));
  }

  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found", 404));

  if (type === "withdrawal" && user.balance < amount) {
    message = "Insufficient balance for withdrawal";
    return next(new AppError(message, 400));
  }

  // Ensure the transaction is created before modifying the user balance
  const transaction = await Transaction.create({
    user: req.user._id,
    amount,
    type,
    status: "completed",
    reference: type === "deposit" ? reference : null,
  });

  // Update user balance correctly
  if (type === "deposit") {
    message = `You just deposited ${amount} into your account`;
    user.balance += amount; // Ensure amount is added once
  } else if (type === "withdrawal") {
    message = `You just withdrew ${amount} from your account`;
    user.balance -= amount;
  }

  await user.save(); // Save the updated balance

  await Notifications.create({
    user: req.user._id,
    title: "Payment",
    message,
    referenceType: "Payment",
    referenceId: transaction._id,
    type: "success",
  });

  sendSuccessResponseData(res, "transaction", transaction, user.balance);
});

// Initialize Transaction
module.exports.initializeTransaction = catchAsync(async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || (!amount && amount !== 0)) {
      return res.status(400).json({ error: "Email and amount are required" });
    }

    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount,
          channels: ["card"], // Restrict to card payments only
          currency: "NGN",
          bearer: "customer",
        }),
      }
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to initialize transaction");

    res.json(data);
  } catch (error) {
    console.error("Error initializing transaction:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// Verify Transaction
module.exports.verifyTransaction = catchAsync(async (req, res) => {
  try {
    const { reference } = req.query;
    console.log("reference", reference);

    if (!reference) {
      return res.status(400).json({ error: "Reference is required" });
    }

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Verification failed");

    console.log("data", data);

    if (data.data.status === "success") {
      // Only verify the payment, don't create transaction or update balance
      res.json({
        status: true,
        message: "Payment verified",
        data: {
          amount: data.data.amount / 100, // Convert back from kobo to naira
        },
      });
    } else {
      res.status(400).json({ status: false, message: "Payment not verified" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message || "Error verifying payment" });
  }
});

// Get banks list
module.exports.getBanksList = catchAsync(async (req, res) => {
  try {
    const response = await fetch(`https://api.paystack.co/bank?currency=NGN`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Failed to load banks");

    // res.json(data.data.map((bank, index) => ({ ...bank, _id: index })));
    res.json({
      ...data,
      data: data.data.map((bank, index) => ({ ...bank, _id: index })),
    });
    // res.json(data);
  } catch (error) {
    console.error("Failed to load banks:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});
module.exports.getAccountDetails = catchAsync(async (req, res) => {
  const { accountNumber, bankCode } = req.body;

  console.log("Account credentials", accountNumber, bankCode);
  try {
    const response = await fetch(
      `https://api.paystack.co/bank/resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to load account details");

    res.json(data);
  } catch (error) {
    console.error("Failed to load account details:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});
// module.exports.createVirtualAccount = catchAsync(async (req, res) => {
//   const {
//     email,
//     firstName: first_name,
//     // last_name,
//     phoneNumber: phone,
//   } = req.user;

//   // res.json(req.user);

//   if (!email || !first_name || !phone) {
//     return res.status(400).json({ error: "All fields are required." });
//   }

//   try {
//     // Step 1: Create customer (or reuse if already exists in your DB)
//     const customerRes = await fetch("https://api.paystack.co/customer", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         email,
//         first_name,
//         // last_name,
//         phone,
//       }),
//     });

//     const customerData = await customerRes.json();

//     if (!customerRes.ok) {
//       throw new Error(
//         customerData.message || "Failed to create Paystack customer"
//       );
//     }

//     const customerCode = customerData.data.customer_code;

//     // Step 2: Create Dedicated Virtual Account for that customer
//     const accountRes = await fetch(
//       "https://api.paystack.co/dedicated_account",
//       {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           customer: customerCode,
//           preferred_bank: "wema-bank", // Optional: You can use "wema-bank", "providus", etc.
//         }),
//       }
//     );

//     const accountData = await accountRes.json();

//     if (!accountRes.ok) {
//       throw new Error(
//         accountData.message || "Failed to create virtual account"
//       );
//     }

//     // Step 3: Return the virtual account details
//     res.json({
//       success: true,
//       message: "Virtual account created successfully",
//       data: accountData.data, // Contains account number, bank name, etc.
//     });
//   } catch (err) {
//     console.error("Error creating virtual account:", err.message);
//     res.status(500).json({ error: err.message || "Internal Server Error" });
//   }
// });

// Generate Monnify Access Token
async function getMonnifyToken() {
  const credentials = Buffer.from(
    `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
  ).toString("base64");

  console.log("API Key:", process.env.MONNIFY_API_KEY);
  console.log("Secret Key:", process.env.MONNIFY_SECRET_KEY);
  console.log("Paystack secret: ", process.env.PAYSTACK_SECRET_KEY);

  const res = await fetch("https://sandbox.monnify.com/api/v1/auth/login", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  console.log("credentials: ", credentials);

  const data = await res.json();

  if (!res.ok)
    throw new Error(
      data.responseMessage || "Unable to authenticate with Monnify"
    );

  return data.responseBody.accessToken;
}

// Controller to Create Static Virtual Account
module.exports.createVirtualAccount = catchAsync(async (req, res) => {
  const { _id: customerRef, firstName: name, email } = req.user;

  // res.json(req.user);

  if (!email || !name || !customerRef) {
    return res
      .status(400)
      .json({ error: "Email, name and customerRef are required." });
  }

  const accessToken = await getMonnifyToken();

  const response = await fetch(
    "https://api.monnify.com/api/v2/bank-transfer/reserved-accounts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountReference: customerRef, // should be unique per user
        accountName: name,
        currencyCode: "NGN",
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        customerEmail: email,
        customerName: name,
        getAllAvailableBanks: true, // returns multiple banks like Wema, Zenith, etc
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Monnify error:", data);
    return res.status(500).json({
      error: data.responseMessage || "Failed to create virtual account",
    });
  }

  res.status(200).json({
    message: "Virtual account created successfully",
    data: data.responseBody,
  });
});

async function createTransferRecipient({ name, account_number, bank_code }) {
  try {
    const response = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name,
        account_number,
        bank_code,
        currency: "NGN",
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new AppError(
        data.message || "Failed to create transfer recipient",
        400
      );
    }

    return data.data.recipient_code;
  } catch (err) {
    throw new AppError(
      err.message || "An error occurred while creating transfer recipient",
      err.statusCode || 500
    );
  }
}

async function initiateTransfer({ amount, recipient_code, reason }) {
  try {
    const response = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: amount * 100, // convert to kobo
        recipient: recipient_code,
        reason,
      }),
    });

    const data = await response.json();

    if (!data.status) {
      throw new AppError(data.message || "Transfer initiation failed", 400);
    }

    return data.data;
  } catch (err) {
    throw new AppError(
      err.message || "An error occurred while initiating transfer",
      err.statusCode || 500
    );
  }
}

module.exports.withdrawFunds = catchAsync(async (req, res, next) => {
  const { amount } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return next(new AppError("Amount must be a positive number", 400));
  }

  const user = await User.findById(req.user._id);

  console.log(user);
  if (!user) return next(new AppError("User not found", 404));

  if (user.balance < amount) {
    return next(new AppError("Insufficient balance", 400));
  }

  // Check if user has bank details
  const { accountNumber, bankCode, accountName } = user.bankDetails;
  if (!accountNumber || !bankCode || !accountName) {
    return next(new AppError("Incomplete bank details", 400));
  }

  // Create transfer recipient
  const recipient_code = await createTransferRecipient({
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
  });

  // Initiate transfer
  const transfer = await initiateTransfer({
    amount,
    recipient_code,
    reason: `Withdrawal by ${user.fullName || user.email}`,
  });

  // Deduct amount from balance
  user.balance -= amount;
  await user.save();

  res.status(200).json({
    status: "success",
    message: "Withdrawal initiated successfully",
    transfer,
    newBalance: user.balance,
  });
});
// Webhook for Paystack
module.exports.webhook = catchAsync(async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.rawBody)
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const paymentData = event.data;
      console.log("Payment Verified via Webhook:", paymentData.reference);

      // TODO: Update database with payment status
      res.status(200).json({ status: "success" });
    } else {
      res.status(400).json({ status: "ignored" });
    }
  } catch (error) {
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
