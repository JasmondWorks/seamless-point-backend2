const shippo = require("../config/shippoConfig");

async function getShippingRates(sender, receiver, parcels) {
  try {
    const res = await fetch(`https://api.goshippo.com/shipments/`, {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address_from: sender,
        address_to: receiver,
        parcels,
        async: false,
        // carrier_accounts: ["*"], // Request rates from all available carriers
      }),
    });

    const shipment = await res.json();

    if (!shipment.rates || shipment.rates.length === 0) {
      throw new Error("No shipping rates available.");
    }

    // Consolidate rates by carrier and service level
    const ratesMap = new Map();

    shipment.rates.forEach((rate) => {
      const key = `${rate.provider} - ${rate.servicelevel.name}`; // Unique key for each service
      if (
        !ratesMap.has(key) ||
        parseFloat(rate.amount) < parseFloat(ratesMap.get(key).amount)
      ) {
        ratesMap.set(key, {
          provider: rate.provider,
          service: rate.servicelevel.name,
          amount: rate.amount,
          currency: rate.currency,
          estimated_days: rate.estimated_days,
        });
      }
    });

    // Convert map values into a clean array
    const consolidatedRates = Array.from(ratesMap.values());

    console.log("Consolidated Rates:", consolidatedRates);

    return consolidatedRates;
  } catch (error) {
    console.error("Error fetching shipping rates:", error);
    throw new Error(error.message);
  }
}

async function purchaseLabel(rateId) {
  try {
    const transaction = await shippo.transaction.create({
      rate: rateId,
      label_file_type: "PDF",
    });

    return {
      tracking_number: transaction.tracking_number,
      tracking_url: transaction.tracking_url_provider,
      label_url: transaction.label_url,
    };
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = { getShippingRates, purchaseLabel };
