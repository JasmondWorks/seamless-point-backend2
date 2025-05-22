const TERMINAL_API_KEY = process.env.TERMINAL_API_KEY || "YOUR_SECRET_KEY";
const TERMINAL_BASE_URL = "https://sandbox.terminal.africa/v1";

const AppError = require("./appError");

const fs = require("fs");
const Fuse = require("fuse.js");

// Load JSON data
// console.log("Directory", __dirname);
// const rawData = fs.readFileSync(`${__dirname}/hscodes.json`, "utf-8");
// const hsCodes = JSON.parse(rawData);

// Setup Fuse.js
// const fuse = new Fuse(hsCodes, {
//   keys: [
//     "chapter_name",
//     "hs_chapter_name",
//     "category",
//     "sub_category",
//     "keywords",
//     "hs_code",
//   ],
//   threshold: 0.3,
//   includeScore: true,
// });

// Search function
module.exports.searchHSCodes = function (query, limit = 5) {
  // const results = fuse.search(query);
  // return results.slice(0, limit).map((result) => result.item);
};

module.exports.generateAddress = async function (addressDetails) {
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
module.exports.createParcel = async function (parcelDetails, packagingDetails) {
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
};

module.exports.fetchAllHSCodes = async function fetchAllHSCodes() {
  let allCodes = [];
  let page = 1;
  let perPage = 200;
  let hasMore = true;

  while (hasMore) {
    try {
      const url = `${TERMINAL_BASE_URL}/hs-codes?page=${page}&perPage=${perPage}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${TERMINAL_API_KEY}`,
        },
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (status ${response.status}): ${errorText}`);
      }

      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Unexpected response format: ${text}`);
      }

      const data = await response.json();

      allCodes = allCodes.concat(data.data.hs_codes);

      // Pagination check — make sure pagination object exists before accessing
      const pagination = data.data.pagination;
      if (!pagination) break;

      hasMore = pagination.currentPage < pagination.pageCount;
      console.log(
        `Fetched page ${page} / ${pagination.pageCount}. Total codes so far: ${allCodes.length}`
      );

      page++;

      // Optional: add delay between requests to avoid hitting rate limit
      await new Promise((resolve) => setTimeout(resolve, 600)); // 500ms delay
    } catch (error) {
      console.error("Error fetching HS codes:", error.message);
      break; // Exit loop on error to avoid infinite loop
    }
  }

  // Save to file
  fs.writeFileSync("./hscodes.json", JSON.stringify(allCodes, null, 2));

  return allCodes;
};
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
