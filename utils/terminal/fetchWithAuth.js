// utils/fetchWithAuth.js
import AppError from "./AppError";

const TERMINAL_API_KEY = process.env.TERMINAL_API_KEY || "YOUR_SECRET_KEY";
const TERMINAL_BASE_URL = "https://sandbox.terminal.africa/v1";

export async function fetchWithAuth(path, options = {}, method = "GET") {
  try {
    const response = await fetch(`${TERMINAL_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.message || data?.error || "Request failed";
      throw new AppError(message, 400);
    }

    return data;
  } catch (error) {
    console.error("Fetch error:", error.message);
    throw error;
  }
}
