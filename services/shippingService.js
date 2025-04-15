require("dotenv").config();
const axios = require("axios");

const SHIPPO_API_KEY = process.env.SHIPPO_API_KEY;

// Courier details
const couriers = [
  {
    name: "UPS",
    tracking_url: "https://www.ups.com/track",
    logo: "https://logos.com/ups.png",
  },
  {
    name: "FedEx",
    tracking_url: "https://www.fedex.com/fedextrack",
    logo: "https://logos.com/fedex.png",
  },
  {
    name: "DHL",
    tracking_url: "https://www.dhl.com/en/express/tracking.html",
    logo: "https://logos.com/dhl.png",
  },
];

// Fetch shipping rates from Shippo API
const getShippingRatesFromShippo = async (fromZip, toZip, weight) => {
  try {
    const response = await axios.post(
      "https://api.goshippo.com/shipments/",
      {
        address_from: { zip: fromZip, country: "US" },
        address_to: { zip: toZip, country: "US" },
        parcels: [{ weight, mass_unit: "kg" }],
      },
      {
        headers: {
          Authorization: `ShippoToken ${SHIPPO_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.rates.map((rate) => ({
      courier: rate.provider,
      service: rate.service,
      price: rate.amount,
      currency: rate.currency,
      estimated_days: rate.estimated_days,
      tracking_url: couriers.find((c) => c.name === rate.provider)
        ?.tracking_url,
      logo: couriers.find((c) => c.name === rate.provider)?.logo,
    }));
  } catch (error) {
    console.error("Error fetching rates:", error);
    return [];
  }
};

// Custom manual shipping rate calculator (fallback)
const getCustomShippingRates = (fromZip, toZip, weight) => {
  const baseFee = 5.0;
  const distanceFee = Math.abs(fromZip - toZip) * 0.02;
  const weightFee = weight * 1.5;

  return couriers.map((courier) => ({
    courier: courier.name,
    service: "Standard",
    price: (baseFee + distanceFee + weightFee).toFixed(2),
    currency: "USD",
    estimated_days: Math.floor(Math.random() * 5) + 2, // Random delivery estimate (2-6 days)
    tracking_url: courier.tracking_url,
    logo: courier.logo,
  }));
};

// Main function to get shipping rates
exports.getShippingRates = async (fromZip, toZip, weight) => {
  const apiRates = await getShippingRatesFromShippo(fromZip, toZip, weight);
  return apiRates.length > 0
    ? apiRates
    : getCustomShippingRates(fromZip, toZip, weight);
};
