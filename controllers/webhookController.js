exports.shippoWebhook = async (req, res) => {
  try {
    const event = req.body;
    console.log("🚀 Webhook Event:", event);

    // TODO: Handle event (update database, send notifications, etc.)

    res.sendStatus(200);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
