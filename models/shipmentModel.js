const mongoose = require("mongoose");

// Define schema
const itemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  name: { type: String, required: true },
  weight: { type: Number, required: true },
  currency: { type: String, required: true },
  value: { type: Number, required: true },
  quantity: { type: Number, required: true },
});

const parcelSchema = new mongoose.Schema({
  description: { type: String, required: true },
  items: { type: [itemSchema], required: true },
  weight_unit: { type: String, required: true },
});

const shipmentSchema = new mongoose.Schema({
  pickupAddress: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
    line1: { type: String, required: true },
    phone: { type: String, required: true },
  },
  deliveryAddress: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    country: { type: String, required: true },
    zip: { type: String, required: true },
    line1: { type: String, required: true },
    phone: { type: String, required: true },
  },
  packagingDetails: {
    height: { type: Number, required: true },
    length: { type: Number, required: true },
    name: { type: String, required: true },
    size_unit: { type: String, required: true },
    type: { type: String, required: true },
    width: { type: Number, required: true },
    weight: { type: Number, required: true },
    weight_unit: { type: String, required: true },
  },
  parcelDetails: { type: parcelSchema, required: true },
  currency: { type: String, required: true },
});

// Create a model (won't be used to save)
const Shipment = mongoose.model("Shipment", shipmentSchema);

module.exports = Shipment;
