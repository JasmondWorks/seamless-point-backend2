const axios = require("axios");
const AppError = require("../utils/appError");
const { catchAsync } = require("../utils/helpers");

const v24uBaseUrl = process.env.V24U_BASE_URL;
const token = process.env.V24U_SECRET_KEY;
const isDev = process.env.NODE_ENV !== "production";

const User = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const Notifications = require("../models/notificationModel");

const getUserBalance = async (userId) => {
  const user = await User.findById(userId).select("balance");
  return user ? user.balance : 0;
};

const normalizeBaseUrl = (path) => {
  if (!v24uBaseUrl) {
    throw new AppError("V24U base URL is not configured", 500);
  }

  const trimmedBase = v24uBaseUrl.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
};

const buildAuthHeaders = () => {
  if (!token) {
    throw new AppError("V24U secret key is not configured", 500);
  }

  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
};

const notifyV24uError = (details) => {
  if (!isDev) return;
  console.error("V24U API error", details);
};

const toAppError = (error) => {
  if (error.response) {
    const { status, statusText, data } = error.response;
    const derivedMessage =
      (data && (data.msg || data.message)) ||
      (typeof data === "string" && data.trim()) ||
      statusText ||
      "V24U request failed";

    notifyV24uError({ status, statusText, data });

    return new AppError(derivedMessage, status || 502);
  }

  if (error.request) {
    notifyV24uError({ message: "No response", request: error.request });
    return new AppError("No response received from V24U service", 502);
  }

  notifyV24uError({ message: error.message });
  return new AppError(error.message, 500);
};

module.exports.getDataBundles = catchAsync(async (req, res) => {
  const { provider, type } = req.query;

  if (!provider) {
    throw new AppError("Query parameter 'provider' is required", 400);
  }

  const url = normalizeBaseUrl("data/bundles");
  const params = { provider };
  if (type) params.type = type;

  try {
    const response = await axios.get(url, {
      params,
      headers: buildAuthHeaders(),
      timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
    });

    const payload = response.data || {};

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Bundles retrieved",
      data: payload.data ?? [],
    });
  } catch (error) {
    throw toAppError(error);
  }
});
module.exports.getTvPlans = catchAsync(async (req, res) => {
  const { provider } = req.query;

  if (!provider) {
    throw new AppError("Query parameter 'provider' is required", 400);
  }

  const url = normalizeBaseUrl("tv/plans");
  const params = { provider };

  try {
    const response = await axios.get(url, {
      params,
      headers: buildAuthHeaders(),
      timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
    });

    const payload = response.data || {};

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Tv plans retrieved",
      data: payload.data ?? [],
    });
  } catch (error) {
    throw toAppError(error);
  }
});

module.exports.verifyTvCardNumber = catchAsync(async (req, res) => {
  const { provider, cardNumber } = req.body || {};

  if (!provider || !cardNumber) {
    throw new AppError(
      "'provider' and 'cardNumber' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("tv/card/verify");

  try {
    const response = await axios.post(
      url,
      { provider, cardNumber },
      {
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
    });
  } catch (error) {
    throw toAppError(error);
  }
});
module.exports.verifyElectricityRecipient = catchAsync(async (req, res) => {
  const { provider, recipient, type } = req.body || {};

  if (!provider || !recipient || !type) {
    throw new AppError(
      "'provider', 'recipient' and 'type' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("electricity/recipient/verify");

  try {
    const response = await axios.post(
      url,
      { provider, recipient, type },
      {
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
    });
  } catch (error) {
    throw toAppError(error);
  }
});
module.exports.buyElectricity = catchAsync(async (req, res) => {
  const { provider, recipient, type, amount, phone } = req.body || {};

  if (!provider || !recipient || !amount || !type || !phone) {
    throw new AppError(
      "'provider', 'recipient', 'amount', 'type' and 'phone' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("electricity/purchase");

  const userId = req.user && req.user._id;
  const userBalance = await getUserBalance(userId);

  if (userBalance < amount) {
    throw new AppError(
      "Insufficient balance to complete this transaction",
      402
    );
  }
  try {
    const response = await axios.post(
      url,
      { provider, recipient, amount, type, phone },
      {
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    await Transaction.create({
      user: userId,
      amount,
      type: "electricity",
      status: payload.status === "success" ? "completed" : "pending",
      reference: payload.data ? payload.data.transactionId : undefined,
    });
    await Notifications.create({
      title: "Electricity",
      message: `Successfully purchased electricity for ₦${amount}`,
      user: req.user,
      referenceType: "Other",
      referenceId: payload.data ? payload.data.transactionId : undefined,
    });
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

    const newBalance = await getUserBalance(userId);
    console.log("User new balance:", newBalance);

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
      balance: newBalance,
    });
  } catch (error) {
    throw toAppError(error);
  }
});
module.exports.buyTvPlan = catchAsync(async (req, res) => {
  const { provider, cardNumber, planCode, amount, phone } = req.body || {};

  if (!provider || !cardNumber || !planCode || !amount || !phone) {
    throw new AppError(
      "'provider', 'cardNumber', 'planCode', 'amount' and 'phone' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("tv/subscribe");

  const userId = req.user && req.user._id;
  const userBalance = await getUserBalance(userId);

  if (userBalance < amount) {
    throw new AppError(
      "Insufficient balance to complete this transaction",
      402
    );
  }
  try {
    const response = await axios.post(
      url,
      { provider, cardNumber, planCode, amount, phone },
      {
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    await Transaction.create({
      user: userId,
      amount,
      type: "tv_plan",
      status: payload.status === "success" ? "completed" : "pending",
      reference: payload.data ? payload.data.transactionId : undefined,
    });
    await Notifications.create({
      title: "TV plan",
      message: `Successfully purchased TV plan for ₦${amount}`,
      user: req.user,
      referenceType: "Other",
      referenceId: payload.data ? payload.data.transactionId : undefined,
    });
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

    const newBalance = await getUserBalance(userId);
    console.log("User new balance:", newBalance);

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
      balance: newBalance,
    });
  } catch (error) {
    throw toAppError(error);
  }
});
module.exports.buyDataBundle = catchAsync(async (req, res) => {
  const { provider, recipient, bundleCode, amount } = req.body || {};
  const { type } = req.query;

  if (!provider || !recipient || !bundleCode || !amount) {
    throw new AppError(
      "'provider', 'recipient', 'bundleCode', and 'amount' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("data");
  const params = {};
  if (type) params.type = type;

  const userId = req.user && req.user._id;
  console.log("User ID:", userId);
  const userBalance = await getUserBalance(userId);
  console.log(userBalance);
  // Optional: You can implement a check to ensure the user has sufficient balance
  // For example, if you know the cost of the bundle, you can compare it with userBalance
  if (userBalance < amount) {
    throw new AppError(
      "Insufficient balance to complete this transaction",
      402
    );
  }
  try {
    const response = await axios.post(
      url,
      { provider, recipient, bundleCode },
      {
        params,
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    await Transaction.create({
      user: userId,
      amount,
      type: "data_bundle",
      status: payload.status === "success" ? "completed" : "pending",
      reference: payload.data ? payload.data.transactionId : undefined,
    });
    await Notifications.create({
      title: "Data bundle",
      message: `Successfully purchased ${bundleCode} data bundle for ₦${amount}`,
      user: req.user,
      referenceType: "Other",
      referenceId: payload.data ? payload.data.transactionId : undefined,
    });
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

    const newBalance = await getUserBalance(userId);
    console.log("User new balance:", newBalance);

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
      balance: newBalance,
    });
  } catch (error) {
    throw toAppError(error);
  }
});

module.exports.topUpAirtime = catchAsync(async (req, res) => {
  const { provider, recipient, amount } = req.body || {};

  if (!provider || !recipient || !amount) {
    throw new AppError(
      "'provider', 'recipient', and 'amount' are required in the request body",
      400
    );
  }

  const url = normalizeBaseUrl("vtu/airtime");

  const userId = req.user && req.user._id;
  console.log("User ID:", userId);
  const userBalance = await getUserBalance(userId);
  console.log(userBalance);
  // Optional: You can implement a check to ensure the user has sufficient balance
  if (userBalance < amount) {
    throw new AppError(
      "Insufficient balance to complete this transaction",
      402
    );
  }

  try {
    const response = await axios.post(
      url,
      { provider, recipient, amount },
      {
        headers: buildAuthHeaders(),
        timeout: Number(process.env.V24U_TIMEOUT_MS) || 15000,
      }
    );

    const payload = response.data || {};

    await Transaction.create({
      user: userId,
      amount,
      type: "airtime_topup",
      status: payload.status === "success" ? "completed" : "pending",
      reference: payload.data ? payload.data.transactionId : undefined,
    });
    await Notifications.create({
      title: "Airtime",
      message: `Successfully purchased ₦${amount} airtime`,
      user: req.user,
      referenceType: "Other",
      referenceId: payload.data ? payload.data.transactionId : undefined,
    });
    await User.findByIdAndUpdate(userId, { $inc: { balance: -amount } });

    const newBalance = await getUserBalance(userId);
    console.log("User new balance:", newBalance);

    return res.status(200).json({
      status: payload.status ?? "success",
      msg: payload.msg ?? "Request processed",
      data: payload.data,
      balance: newBalance,
    });
  } catch (error) {
    throw toAppError(error);
  }
});
