require("dotenv").config({ path: "./config.env" });
const crypto = require("crypto");
const axios = require("axios");

// Mock webhook payload for testing
const mockWebhookPayload = {
  event: "charge.success",
  data: {
    reference: "test_ref_" + Date.now(),
    amount: 5000000, // 50000 NGN in kobo
    customer: {
      email: "obafemilared@gmail.com", // Replace with a real user email from your DB
    },
  },
};

// Your Paystack test secret key
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

if (!PAYSTACK_SECRET) {
  console.error("PAYSTACK_SECRET_KEY not found in environment variables");
  process.exit(1);
}

// Generate signature
const payloadString = JSON.stringify(mockWebhookPayload);
const signature = crypto
  .createHmac("sha512", PAYSTACK_SECRET)
  .update(payloadString)
  .digest("hex");

// Debug logs removed

async function testWebhook() {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/v1/transactions/webhook",
      mockWebhookPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-paystack-signature": signature,
        },
      }
    );

    console.log("Webhook response:", response.data);
    console.log("Status:", response.status);
  } catch (error) {
    console.error(
      "Error testing webhook:",
      error.response?.data || error.message
    );
  }
}

testWebhook();
