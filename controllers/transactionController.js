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

async function getOrCreatePaystackCustomer({
  email,
  first_name,
  last_name,
  phone,
}) {
  try {
    // --- normalize/validate inputs ---
    const e = String(email ?? "").trim();
    const fn = String(first_name ?? "").trim();
    const ln = String(last_name ?? "").trim();
    const ph = normalizePhone(phone);

    if (!e || !fn || !ln) {
      throw new Error("Missing required fields: email/first_name/last_name");
    }

    // --- try to find existing by email ---
    const listCustomersRes = await fetch(
      `https://api.paystack.co/customer?email=${encodeURIComponent(e)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          Accept: "application/json",
        },
      }
    );
    const listData = await listCustomersRes.json();

    if (
      listCustomersRes.ok &&
      Array.isArray(listData?.data) &&
      listData.data.length > 0
    ) {
      const existing = listData.data[0];

      // Patch any missing fields (names/phone) on the Paystack record
      const patch = {};
      if (!existing.first_name && fn) patch.first_name = fn;
      if (!existing.last_name && ln) patch.last_name = ln;
      if ((!existing.phone || existing.phone.trim() === "") && ph)
        patch.phone = ph;

      if (Object.keys(patch).length > 0) {
        const updateRes = await fetch(
          `https://api.paystack.co/customer/${existing.id}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(patch),
          }
        );
        const updateData = await updateRes.json();
        if (updateRes.ok) {
          return updateData.data; // includes customer_code
        } else {
          console.warn(
            "Failed to update customer fields:",
            updateData?.message
          );
          // fall through and return existing
        }
      }

      return existing; // already has customer_code
    }

    // --- create new customer ---
    const payload = {
      email: e,
      first_name: fn,
      last_name: ln,
      ...(ph ? { phone: ph } : {}),
    };
    console.log("Creating Paystack customer with payload:", payload);

    const customerRes = await fetch("https://api.paystack.co/customer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const customerData = await customerRes.json();
    if (!customerRes.ok) {
      // Surface Paystack’s exact validation message (e.g., "last_name is required...")
      throw new Error(
        customerData?.message || "Failed to create Paystack customer"
      );
    }
    return customerData.data; // includes customer_code
  } catch (error) {
    throw new Error(`Customer operation failed: ${error.message}`);
  }
}

// Helper: normalize Nigerian numbers to E.164
function normalizePhone(phone) {
  if (!phone) return "";
  const p = String(phone).trim();
  if (p.startsWith("+")) return p; // already E.164
  if (p.startsWith("0")) return `+234${p.slice(1)}`;
  if (p.startsWith("234")) return `+${p}`;
  return p; // leave as-is (best effort)
}

module.exports.getCustomer = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const {
    email,
    firstName: first_name,
    lastName: last_name,
    phoneNumber: phone,
  } = user;

  if (!email || !first_name) {
    return res.status(400).json({
      error: "Email and first name are required to get customer information.",
    });
  }

  try {
    const customer = await getOrCreatePaystackCustomer({
      email,
      first_name,
      last_name,
      phone,
    });

    res.status(200).json({
      success: true,
      message: "Customer retrieved successfully",
      data: customer,
    });
  } catch (error) {
    console.error("Error getting customer:", error.message);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

async function storeVirtualAccountOnUser(
  userId,
  account,
  paystackCustomerCode = null
) {
  const user = await User.findById(userId);

  console.log("virtual account details", account);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  user.virtualAccount = {
    accountNumber: account.account_number,
    accountName: account.account_name,
    bankName: account.bank.name,
    bankCode: account.bank.id.toString(),
    customerCode: paystackCustomerCode,
    paystackCustomerCode: paystackCustomerCode,
    createdAt: account.created_at ? new Date(account.created_at) : new Date(),
  };

  await user.save();

  return user.virtualAccount;
}

module.exports.getBankProviders = catchAsync(async (req, res) => {
  const providersRes = await fetch(
    "https://api.paystack.co/dedicated_account/available_providers",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    }
  );

  const data = await providersRes.json();

  console.log("account data", data);

  if (!providersRes.ok) {
    throw new Error(data.message || "Failed to get bank providers");
  }

  sendSuccessResponseData(res, "providers", data);
});
module.exports.createVirtualAccount = catchAsync(async (req, res) => {
  const existingUser = await User.findById(req.user._id);

  if (!existingUser) {
    return res.status(404).json({ error: "User not found." });
  }

  const email =
    existingUser.email ||
    req.user.email ||
    req.user?.user_email ||
    req.user?.emailAddress;
  const first_name =
    existingUser.firstName ||
    req.user.firstName ||
    req.user.first_name ||
    req.user?.user_firstname;
  const last_name =
    existingUser.lastName ||
    req.user.lastName ||
    req.user.last_name ||
    req.user?.user_lastname;
  const phone =
    existingUser.phoneNumber ||
    req.user.phoneNumber ||
    req.user.phone_number ||
    req.user.phone ||
    req.user?.user_phone;

  console.log("user", {
    id: existingUser._id,
    email,
    first_name,
    last_name,
    phone,
  });

  const normalizedLastName = String(last_name ?? "").trim();

  if (!email || !first_name || normalizedLastName.length === 0) {
    return res.status(400).json({
      error:
        "Email, first name, and last name are required before creating a virtual account.",
    });
  }

  console.log("phone", phone);

  // Check for existing virtual account
  if (
    existingUser &&
    existingUser.virtualAccount &&
    existingUser.virtualAccount.accountNumber
  ) {
    return res.status(200).json(existingUser.virtualAccount);
  }

  try {
    // Step 1: Get or create Paystack customer (avoid duplicates)
    let customerCode = existingUser?.virtualAccount?.customerCode;

    if (!customerCode) {
      const customer = await getOrCreatePaystackCustomer({
        email,
        first_name,
        last_name: normalizedLastName,
        phone,
      });

      console.log("*****");
      console.log("customer", customer);
      console.log("*****");

      customerCode = customer.customer_code;

      // Save customer code to user
      existingUser.set("virtualAccount.customerCode", customerCode);
      await existingUser.save();
    }

    console.log("*****");
    console.log("here");
    console.log("*****");
    // Step 2: Create Dedicated Virtual Account for that customer
    const accountRes = await fetch(
      "https://api.paystack.co/dedicated_account",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: "wema-bank", // Optional: You can use "wema-bank", "providus", etc.
        }),
      }
    );

    const accountData = await accountRes.json();

    console.log("account data", accountData);

    if (!accountRes.ok) {
      throw new Error(
        accountData.message || "Failed to create virtual account"
      );
    }

    // Step 3: Store virtual account on user
    const savedAccount = await storeVirtualAccountOnUser(
      req.user._id,
      accountData.data,
      customerCode
    );

    // Step 4: Return the virtual account details
    res.json({
      success: true,
      message: "Virtual account created successfully",
      data: savedAccount,
    });
  } catch (err) {
    console.error("Error creating virtual account:", err.message);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

module.exports.deleteVirtualAccount = catchAsync(async (req, res) => {
  const { _id: customerRef } = req.user;

  if (!customerRef) {
    return res.status(400).json({
      error: "Customer reference is required.",
    });
  }

  // Note: Paystack supports deactivating dedicated virtual accounts, but we'll use soft delete
  // We'll mark it as deleted in our database but the account remains active in Paystack
  // This allows for re-enabling without API calls

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
  console.log("webhook call body", req.body);

  try {
    // validate event
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    // Signature verification logs removed

    if (hash !== signature) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;
    console.log("event", event);

    if (event.event === "charge.success") {
      const { reference, amount, customer, fees } = event.data;
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
        const calculatedAmount = amount - fees;
        const transaction = await Transaction.create({
          user: user._id,
          amount: calculatedAmount / 100, // Convert from kobo to naira
          type: "deposit",
          status: "completed",
          reference,
        });

        // Update user balance
        user.balance += calculatedAmount / 100;
        await user.save();

        // Send notification
        await Notifications.create({
          user: user._id,
          title: "Payment",
          message: `Payment of ₦${calculatedAmount / 100} received successfully`,
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
