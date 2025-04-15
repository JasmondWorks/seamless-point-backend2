const { trackShipment } = require("../services/trackingService");

exports.getTrackingInfo = async (req, res) => {
  try {
    const { carrier, trackingNumber } = req.query;

    if (!carrier || !trackingNumber) {
      return res
        .status(400)
        .json({ error: "Carrier and tracking number are required" });
    }

    const trackingInfo = await trackShipment(carrier, trackingNumber);
    res.json(trackingInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
