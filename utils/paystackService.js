const axios = require("axios");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE_URL = "https://api.paystack.co";

// Function to initialize a payment
const initializePayment = async (email, amount) => {
  try {
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      { email, amount: amount * 100 }, // Paystack expects amount in kobo (smallest currency unit)
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data; // Returns the payment authorization URL
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Payment initialization failed"
    );
  }
};

// Function to verify a transaction
const verifyPayment = async (reference) => {
  try {
    const response = await axios.get(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      }
    );
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Transaction verification failed"
    );
  }
};

module.exports = { initializePayment, verifyPayment };
