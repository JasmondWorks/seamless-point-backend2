const AppError = require("./appError");

const TERMINAL_API_KEY = process.env.TERMINAL_API_KEY || "YOUR_SECRET_KEY";
const TERMINAL_BASE_URL = process.env.TERMINAL_BASE_URL;

module.exports.generateAddress = async function (addressDetails) {
  try {
    const isAddressValid = await validateAddress(addressDetails);

    console.log(isAddressValid);
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
};
async function validateAddress(addressDetails) {
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
module.exports.createParcel = async function (parcelDetails) {
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

    console.log("Parcel", data);

    if (!response.ok) throw new AppError(data.message, 400);

    return data?.data?.parcel_id;
  } catch (error) {
    console.error(error.message);
    return { status: "error", message: error.message };
  }
};

module.exports.fetchAllCategories = async function fetchAllHSCodes() {
  console.log(TERMINAL_API_KEY);
  const initialRes = await fetch(`${TERMINAL_BASE_URL}/hs-codes/simplified`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
    },
  });

  const initialData = await initialRes.json();

  console.log("initial hscode categories data", initialData);

  const totalItems = initialData?.data?.pagination?.total;

  const url = `${TERMINAL_BASE_URL}/hs-codes/simplified?perPage=${totalItems}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
    },
  });
  const data = await response.json();

  const formattedData =
    data?.data?.hs_codes.map((item) => ({
      hsCode: item.hs_code,
      hsCodeLabel: item.sub_category,
      category: item.chapter_name,
      subCategory: item.category,
      id: item._id,
    })) || [];

  return formattedData;
};
