async function trackShipment(carrier, trackingNumber) {
  try {
    return await shippo.track.get_status(carrier, trackingNumber);
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = { trackShipment };
