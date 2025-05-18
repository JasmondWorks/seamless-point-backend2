import AppError from "./appError.js";

const TERMINAL_API_KEY = process.env.TERMINAL_API_KEY || "YOUR_SECRET_KEY";
const TERMINAL_BASE_URL = "https://sandbox.terminal.africa/v1";

export async function generateAddress(addressDetails) {
  try {
    const isAddressValid = await validateAddress(addressDetails);

    if (isAddressValid.status === "error")
      throw new AppError(isAddressValid.message, 400);

    const response = await fetch(`${TERMINAL_BASE_URL}/addresses`, {
      method: "POST",
      body: JSON.stringify(addressDetails),
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (!response.ok) throw new AppError(data.message, 400);

    return data?.data?.address_id;
  } catch (error) {
    console.error(error.message);
    return { status: "error", message: error.message };
  }
}
export async function validateAddress(addressDetails) {
  try {
    const response = await fetch(`${TERMINAL_BASE_URL}/addresses/validate`, {
      method: "POST",
      body: JSON.stringify(addressDetails),
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    console.log(data);

    if (!response.ok) throw new AppError(data.message, 400);

    return data?.data?.is_valid;
  } catch (error) {
    console.error(error.message);
    return { status: "error", message: error.message };
  }
}
export async function createParcel(parcelDetails, packagingDetails) {
  const packagingId = await createPackaging(packagingDetails);
  parcelDetails.packaging = packagingId;

  try {
    const response = await fetch(`${TERMINAL_BASE_URL}/parcels`, {
      method: "POST",
      body: JSON.stringify(parcelDetails),
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    console.log(data);

    if (!response.ok) throw new AppError(data.message, 400);

    return data?.data?.parcel_id;
  } catch (error) {
    console.error(error.message);
    return { status: "error", message: error.message };
  }
}

async function createPackaging(packagingDetails) {
  try {
    const response = await fetch(`${TERMINAL_BASE_URL}/packaging`, {
      method: "POST",
      body: JSON.stringify(packagingDetails),
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    if (!response.ok) throw new AppError(data.message, 400);

    return data?.data.packaging_id;
  } catch (error) {
    console.error(error.message);
    return { status: "error", message: error.message };
  }
}
