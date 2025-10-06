const crypto = require("crypto");
const Transaction = require("../models/transactionModel");
const User = require("../models/userModel");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const AppError = require("../utils/appError");
const Notifications = require("../models/notificationModel");

const MONNIFY_BASE_URL =
  process.env.MONNIFY_BASE_URL || "https://sandbox.monnify.com";

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
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
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
// Generate Monnify Access Token
async function getMonnifyToken() {
  const credentials = Buffer.from(
    `${process.env.MONNIFY_API_KEY}:${process.env.MONNIFY_SECRET_KEY}`
  ).toString("base64");

  console.log("API Key:", process.env.MONNIFY_API_KEY);
  console.log("Secret Key:", process.env.MONNIFY_SECRET_KEY);

  const res = await fetch("https://sandbox.monnify.com/api/v1/auth/login", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  const data = await res.json();

  if (!res.ok)
    throw new Error(
      data.responseMessage || "Unable to authenticate with Monnify"
    );

  return data.responseBody.accessToken;
}

async function fetchMonnifyReservedAccounts(accessToken, email) {
  const attempts = [];

  const queryPayload = {
    page: 0,
    size: 50,
    customerEmail: email,
  };

  if (process.env.MONNIFY_CONTRACT_CODE) {
    queryPayload.contractCode = process.env.MONNIFY_CONTRACT_CODE;
  }

  attempts.push({
    label: "query-post",
    url: `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts/query`,
    options: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryPayload),
    },
    extract: (payload) =>
      payload?.responseBody?.content || payload?.responseBody?.accounts || [],
  });

  const params = new URLSearchParams({
    customerEmail: email,
    page: "0",
    size: "50",
  });

  if (process.env.MONNIFY_CONTRACT_CODE) {
    params.append("contractCode", process.env.MONNIFY_CONTRACT_CODE);
  }

  attempts.push({
    label: "list-get",
    url: `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts?${params.toString()}`,
    options: {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    extract: (payload) =>
      payload?.responseBody?.content || payload?.responseBody?.accounts || [],
  });

  for (const attempt of attempts) {
    try {
      const response = await fetch(attempt.url, attempt.options);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload?.responseMessage ||
          payload?.message ||
          response.statusText ||
          "Failed to fetch reserved accounts.";

        console.error(
          `Monnify reserved account lookup (${attempt.label}) failed:`,
          `${response.status} ${message}`
        );
        continue;
      }

      const accounts = attempt.extract(payload);

      if (Array.isArray(accounts) && accounts.length > 0) {
        return accounts;
      }
    } catch (error) {
      console.error(
        `Monnify reserved account lookup (${attempt.label}) encountered error:`,
        error.message
      );
    }
  }

  return [];
}

async function storeVirtualAccountOnUser(userId, account) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.virtualAccount = {
    accountNumber: account.accountNumber,
    accountName: account.accountName,
    bankName: account.bankName,
    bankCode: account.bankCode,
    createdAt: account.createdOn ? new Date(account.createdOn) : new Date(),
  };

  await user.save();

  return user.virtualAccount;
}

module.exports.createVirtualAccount = catchAsync(async (req, res) => {
  const { _id: customerRef, firstName: name, email } = req.user;

  if (!email || !name || !customerRef) {
    return res.status(400).json({
      error: "Email, name and customerRef are required.",
    });
  }

  const existingUser = await User.findById(req.user._id);
  if (
    existingUser &&
    existingUser.virtualAccount &&
    existingUser.virtualAccount.accountNumber
  ) {
    if (!existingUser.virtualAccount.isDeleted) {
      return res.status(200).json({
        message: "Virtual account already exists",
        data: existingUser.virtualAccount,
      });
    } else {
      // Re-enable the deleted account
      existingUser.virtualAccount.isDeleted = false;
      await existingUser.save();
      return res.status(200).json({
        message: "Virtual account re-enabled successfully",
        data: existingUser.virtualAccount,
      });
    }
  }

  const accessToken = await getMonnifyToken();

  let reservedAccounts = await fetchMonnifyReservedAccounts(accessToken, email);

  console.log("reserved", reservedAccounts);

  if (reservedAccounts.length > 0) {
    const account = reservedAccounts[0];
    const savedAccount = await storeVirtualAccountOnUser(req.user._id, account);

    return res.status(200).json({
      message: "Virtual account retrieved successfully",
      data: savedAccount,
    });
  }

  const accountReference = `${customerRef}_${Date.now()}`;

  const response = await fetch(
    `${MONNIFY_BASE_URL}/api/v2/bank-transfer/reserved-accounts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountReference,
        accountName: name,
        currencyCode: "NGN",
        contractCode: process.env.MONNIFY_CONTRACT_CODE,
        customerEmail: email,
        customerName: name,
        getAllAvailableBanks: true,
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      data?.responseMessage ||
      data?.message ||
      "Failed to create virtual account";

    const fallbackAccounts = Array.isArray(data?.responseBody?.accounts)
      ? data.responseBody.accounts
      : Array.isArray(data?.responseBody?.content)
        ? data.responseBody.content
        : [];

    if (fallbackAccounts.length > 0) {
      const account = fallbackAccounts[0];
      const savedAccount = await storeVirtualAccountOnUser(
        req.user._id,
        account
      );

      return res.status(200).json({
        message: "Virtual account retrieved successfully",
        data: savedAccount,
      });
    }

    if (
      typeof errorMessage === "string" &&
      errorMessage.toLowerCase().includes("cannot reserve more than 1 account")
    ) {
      reservedAccounts = await fetchMonnifyReservedAccounts(accessToken, email);

      if (reservedAccounts.length > 0) {
        const account = reservedAccounts[0];
        const savedAccount = await storeVirtualAccountOnUser(
          req.user._id,
          account
        );

        return res.status(200).json({
          message: "Virtual account retrieved successfully",
          data: savedAccount,
        });
      }
    }

    throw new AppError(errorMessage);
  }

  const accounts = data?.responseBody?.accounts;

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new AppError("Monnify did not return any virtual account details.");
  }

  const savedAccount = await storeVirtualAccountOnUser(
    req.user._id,
    accounts[0]
  );

  res.status(200).json({
    message: "Virtual account created successfully",
    data: savedAccount,
  });
});

module.exports.deleteVirtualAccount = catchAsync(async (req, res) => {
  const { _id: customerRef } = req.user;

  if (!customerRef) {
    return res.status(400).json({
      error: "Customer reference is required.",
    });
  }

  // Note: Monnify doesn't support DELETE method for virtual accounts
  // We'll remove it from our database but the account remains active in Monnify
  // This is a limitation of Monnify's API

  try {
    // Remove virtual account from user database only
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (!user.virtualAccount) {
      return res.status(400).json({
        error: "No virtual account found to delete",
      });
    }

    user.virtualAccount.isDeleted = true;
    await user.save();

    res.status(200).json({
      message:
        "Virtual account removed from your profile. Note: The account remains active in the banking system but is no longer linked to your profile.",
    });
  } catch (error) {
    console.error("Database error during virtual account deletion:", error);
    res.status(500).json({
      error: "Failed to remove virtual account from profile",
    });
  }
});

module.exports.getVirtualAccount = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) return res.status(404).json({ error: "User not found" });

  if (
    !user.virtualAccount ||
    !user.virtualAccount.accountNumber ||
    user.virtualAccount.isDeleted
  ) {
    return res.status(404).json({
      error: "No active virtual account found",
    });
  }

  res.status(200).json({
    message: "Virtual account retrieved successfully",
    data: user.virtualAccount,
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

    // Signature verification logs removed

    if (hash !== signature) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { reference, amount, customer } = event.data;
      console.log("Payment Verified via Webhook:", reference);

      try {
        // Check for idempotency - prevent duplicate processing
        const existingTransaction = await Transaction.findOne({ reference });
        if (existingTransaction) {
          console.log("Transaction already processed:", reference);
          return res.status(200).json({ status: "already processed" });
        }

        // Find user by email
        const user = await User.findOne({ email: customer.email });
        if (!user) {
          console.error("User not found for webhook:", customer.email);
          return res.status(200).json({ status: "user not found" });
        }

        // Create transaction record
        const transaction = await Transaction.create({
          user: user._id,
          amount: amount / 100, // Convert from kobo to naira
          type: "deposit",
          status: "completed",
          reference,
        });

        // Update user balance
        user.balance += amount / 100;
        await user.save();

        // Send notification
        await Notifications.create({
          user: user._id,
          title: "Payment",
          message: `Payment of ₦${amount / 100} received successfully`,
          referenceType: "Payment",
          referenceId: transaction._id,
          type: "success",
        });

        console.log("Payment processed successfully:", reference);
        res.status(200).json({ status: "success" });
      } catch (processingError) {
        console.error("Webhook processing error:", processingError);
        res.status(500).json({ error: "Webhook processing failed" });
      }
    } else {
      res.status(200).json({ status: "ignored" });
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
