// user have notifications
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    // Title or brief message for the notification
    title: {
      type: String,
      required: true,
    },

    // Detailed message for the notification
    message: {
      type: String,
      required: true,
    },

    // The user who will receive the notification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Type of the notification (e.g., "Payment", "Delivery", "Other")
    referenceType: {
      type: String,
      required: true,
      enum: ["Payment", "Delivery", "Other"], // Add more as needed
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // type of the notification (e.g., "info", "warning", "success", "error", etc.)
    type: {
      type: String,
      enum: ["info", "warning", "success", "error"],
      default: "info",
    },

    // Flag to check if the notification has been read by the user
    isRead: {
      type: Boolean,
      default: false,
    },

    // Status of the notification (e.g., "sent", "delivered", "failed")
    //   status: {
    //     type: String,
    //     enum: ["sent", "delivered", "failed"],
    //     default: "sent",
    //   },
  },
  { timestamps: true }
);

// Method to mark notification as read
notificationSchema.methods.markAsRead = function () {
  this.isRead = true;
  return this.save();
};

// Export the model
const Notifications = mongoose.model("Notification", notificationSchema);
module.exports = Notifications;
