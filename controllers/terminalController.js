const AppError = require("../utils/appError");
const Shipment = require("../models/shipmentModel");

const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const axios = require("axios");
const {
  generateAddress,
  createParcel,
  searchHSCodes,
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

module.exports.createAddress = catchAsync(async (req, res) => {
  const {
    city,
    state,
    country,
    email,
    firstName: first_name,
    // isResidential: is_residential,
    lastName: last_name,
    line1,
    // line2,
    // metadata,
    // fullName: name,
    phone,
    zip,
  } = req.body;

  const payload = {
    city,
    country,
    email,
    first_name,
    // is_residential,
    last_name,
    line1,
    // line2,
    // metadata,
    // name,
    phone,
    state,
    zip,
  };

  const newAddress = await generateAddress(payload);

  console.log(newAddress);

  sendSuccessResponseData(res, "address", newAddress);
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

  if (pickup_address_id.status === "error")
    throw new AppError(pickup_address_id.message);
  if (delivery_address_id.status === "error")
    throw new AppError(delivery_address_id.message);
  if (parcel_id.status === "error")
    throw new AppError(
      "Cannot generate a parcel at this time. Try again later"
    );

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
  const data = await response.json();

  console.log(data);

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
module.exports.getHsCodesFromDescription = catchAsync(async (req, res) => {
  // const allHsCodes = ;

  const query = req.body.query || "electronics";

  const results = searchHSCodes(query);

  console.log("Search results:");
  console.log(results);

  sendSuccessResponseData(res, "hsCodes", results);
});
