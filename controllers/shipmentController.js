const {
  getShippingRates,
  purchaseLabel,
} = require("../services/shippoService");

exports.calculateRates = async (req, res) => {
  try {
    const { sender, receiver, parcels } = req.body;

    if (!sender || !receiver || !parcels) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const rates = await getShippingRates(sender, receiver, parcels);
    res.json({ rates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.buyShippingLabel = async (req, res) => {
  try {
    const { rateId } = req.body;

    if (!rateId) {
      return res.status(400).json({ error: "Rate ID is required" });
    }

    const label = await purchaseLabel(rateId);
    res.json(label);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
