const path = require("path");
const fs = require("fs");

const AppError = require("../utils/appError");
const Shipment = require("../models/shipmentModel");

const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const axios = require("axios");
const {
  generateAddress,
  createParcel,
  searchHSCodes,
  fetchAllHSCodes,
  fetchAllCategories,
  // fetchAllHSCodes,
} = require("../utils/terminal");

const TERMINAL_API_KEY = process.env.TERMINAL_API_KEY || "YOUR_SECRET_KEY";
const TERMINAL_BASE_URL = "https://sandbox.terminal.africa/v1";

module.exports.getCountries = catchAsync(async (_, res) => {
  const response = await axios.get(`${TERMINAL_BASE_URL}/countries`, {
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  sendSuccessResponseData(res, "countries", response?.data?.data);
});
module.exports.getStates = catchAsync(async (req, res) => {
  const { countryCode } = req.query;

  if (!countryCode)
    throw new AppError("Please provide all query parameters: countryCode", 400);

  console.log(countryCode);

  const response = await axios.get(
    `${TERMINAL_BASE_URL}/states?country_code=${countryCode}`,
    {
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  sendSuccessResponseData(res, "states", response?.data?.data);
});
module.exports.getCities = catchAsync(async (req, res) => {
  const { countryCode, stateCode } = req.query;

  if (!countryCode || !stateCode)
    throw new AppError(
      "Please provide all query parameters: countryCode, stateCode",
      400
    );

  const response = await axios.get(
    `${TERMINAL_BASE_URL}/cities?country_code=${countryCode}&state_code=${stateCode}`,
    {
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  sendSuccessResponseData(res, "cities", response?.data);
});

module.exports.validateAddress = catchAsync(async (req, res) => {
  const {
    city,
    state,
    country,
    email,
    firstName: first_name,
    lastName: last_name,
    line1,
    phone,
    zip,
  } = req.body;

  const payload = {
    city,
    country,
    email,
    first_name,
    last_name,
    line1,
    phone,
    state,
    zip,
  };

  const response = await fetch(`${TERMINAL_BASE_URL}/addresses/validate`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "address", {
    id: data.data.address_id,
    message: data.message,
  });
});
module.exports.createAddress = catchAsync(async (req, res) => {
  const {
    city,
    state,
    country,
    email,
    firstName: first_name,
    lastName: last_name,
    line1,
    phone,
    zip,
  } = req.body;

  const payload = {
    city,
    country,
    email,
    first_name,
    last_name,
    line1,
    phone,
    state,
    zip,
  };

  const response = await fetch(`${TERMINAL_BASE_URL}/addresses`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "address", {
    id: data.data.address_id,
    message: data.message,
  });
});
module.exports.getRates = catchAsync(async (req, res) => {
  const {
    pickupAddress,
    deliveryAddress,
    currency,
    parcelDetails,
    packagingDetails,
  } = req.body;

  const shipment = new Shipment(req.body);

  await shipment.validate();

  const pickup_address_id = await generateAddress(pickupAddress);
  const delivery_address_id = await generateAddress(deliveryAddress);
  const parcel_id = await createParcel(parcelDetails, packagingDetails);

  console.log("Parcel id", parcel_id);
  console.log("Pickup address id", pickup_address_id);
  console.log("Delivery address id", delivery_address_id);
  console.log("Parcel id", parcel_id);

  if (pickup_address_id.status === "error")
    throw new AppError(pickup_address_id.message);
  if (delivery_address_id.status === "error")
    throw new AppError(delivery_address_id.message);
  if (parcel_id.status === "error") throw new AppError(parcel_id.message);

  const response = await fetch(
    `${TERMINAL_BASE_URL}/rates/shipment/?delivery_address=${delivery_address_id}&pickup_address=${pickup_address_id}&currency=${currency}&parcel_id=${parcel_id}`,
    {
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  let data = await response.json();

  data = {
    ...data,
    pickupAddressId: pickup_address_id,
    deliveryAddressId: delivery_address_id,
    parcelId: parcel_id,
  };

  if (!response.ok) throw new AppError(`${data.message}`, 400);

  sendSuccessResponseData(res, "rates", data);
});
module.exports.getRate = catchAsync(async (req, res) => {
  const { id } = req.params;

  console.log(id);

  if (!id) throw new AppError("Rate id param must be provided");

  const response = await fetch(`${TERMINAL_BASE_URL}/rates/${id}`, {
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  let data = await response.json();

  if (!response.ok) throw new AppError(`${data.message}`, 400);

  sendSuccessResponseData(res, "rate", data);
});
module.exports.getShipment = catchAsync(async (req, res) => {
  const { id } = req.params;

  console.log(id);

  if (!id) throw new AppError("Shipment id param must be provided");

  const response = await fetch(`${TERMINAL_BASE_URL}/shipments/${id}`, {
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  let data = await response.json();

  if (!response.ok) throw new AppError(`${data.message}`, 400);

  sendSuccessResponseData(res, "shipment", data);
});
module.exports.createShipment = catchAsync(async (req, res) => {
  const { pickupAddressId, deliveryAddressId, parcelId } = req.body;

  const payload = {
    address_from: pickupAddressId,
    address_to: deliveryAddressId,
    parcel: parcelId,
  };

  const response = await fetch(`${TERMINAL_BASE_URL}/shipments`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "shipment", data);
});
module.exports.trackShipment = catchAsync(async (req, res) => {
  const { shipmentId } = req.params;

  const response = await fetch(
    `${TERMINAL_BASE_URL}/shipments/track/${shipmentId}`,
    {
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const data = await response.json();

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "shipmentStatus", data);
});
module.exports.arrangeShipmentPickup = catchAsync(async (req, res) => {
  const { shipmentId, rateId } = req.body;

  const payload = {
    rate_id: rateId,
    shipment_id: shipmentId,
  };

  const response = await fetch(`${TERMINAL_BASE_URL}/shipments/pickup`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  console.log("response", response);
  const data = await response.json();

  console.log("pickup data", data);

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "shipmentStatus", data);
});
module.exports.cancelShipment = catchAsync(async (req, res) => {
  const { shipmentId } = req.body;

  const response = await fetch(`${TERMINAL_BASE_URL}/shipments/cancel`, {
    method: "POST",
    body: JSON.stringify({ shipment_id: shipmentId }),
    headers: {
      Authorization: `Bearer ${TERMINAL_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "shipmentStatus", data);
});

module.exports.searchHsCode = catchAsync(async (req, res) => {
  const query = (req.query.q || "").toLowerCase();

  const jsonPath = path.join(process.cwd(), "data", "hscodes.json");

  fs.readFile(jsonPath, "utf-8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({ message: "Error reading HS codes" });
    }

    try {
      const jsonData = JSON.parse(data);

      // Filter by label or keywords
      const filtered = jsonData.filter((item) => {
        return (
          item.label.toLowerCase().includes(query) ||
          item.keywords.toLowerCase().includes(query)
        );
      });

      // Return top 50 matches
      const result = filtered.slice(0, 50);

      sendSuccessResponseData(res, "hsCodes", result);
    } catch (parseErr) {
      console.error("Error parsing JSON:", parseErr);
      return res.status(500).json({ message: "Error parsing HS codes" });
    }
  });
});

module.exports.getCategories = catchAsync(async (_, res) => {
  const allCategories = await fetchAllCategories();

  const categories = [];

  allCategories.forEach((item) => {
    // Find or create category
    let category = categories.find((c) => c.name === item.category);
    if (!category) {
      category = {
        name: item.category,
        subcategories: [],
      };
      categories.push(category);
    }

    // Find or create subcategory
    let subCategory = category.subcategories.find(
      (sc) => sc.name === item.subCategory
    );
    if (!subCategory) {
      subCategory = {
        name: item.subCategory,
        hsCodes: [],
      };
      category.subcategories.push(subCategory);
    }

    // Add hsCode if not duplicate
    const exists = subCategory.hsCodes.some(
      (h) => h.hsCode === item.hsCode && h.label === item.hsCodeLabel
    );

    if (!exists) {
      subCategory.hsCodes.push({
        label: item.hsCodeLabel,
        hsCode: item.hsCode,
      });
    }
  });

  sendSuccessResponseData(res, "categories", categories);
});
module.exports.getSubCategories = catchAsync(async (req, res) => {
  const response = await fetch(
    `${TERMINAL_BASE_URL}/hs-codes/simplified/category`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${TERMINAL_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  const { category } = req;

  const hsCodes = [];
  const page = 1;

  const data = await response.json();

  if (!response.ok) throw new AppError(data.message, 400);

  sendSuccessResponseData(res, "categories", data);
});
