const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const APIFEATURES = require("../utils/apiFeatures");
const Notifications = require("../models/notificationModel");

module.exports.getAllNotifications = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Notifications, req.query)
    .filter()
    .limitFields()
    .sort()
    .paginate();

  const totalCount = await Notifications.countDocuments();

  const notifications = await apiFeatures.query;

  sendSuccessResponseData(res, "notifications", notifications, totalCount);
});

module.exports.getUserNotifications = catchAsync(async (req, res) => {
  const user = req.user;
  // use APIFEATURES to get all notifications for the user
  const apiFeatures = new APIFEATURES(Notifications, req.query)
    .filter({ user: user.id })
    .limitFields()
    .sort()
    .paginate();

  const totalCount = await Notifications.countDocuments({ user: user.id });

  const notifications = await apiFeatures.query;

  sendSuccessResponseData(res, "notifications", notifications, totalCount);
});

module.exports.getNotification = catchAsync(async (req, res) => {
  const notificationId = req.params.id;

  const notification = await Notifications.findById(notificationId);

  if (!notification) throw new AppError("Notification could not be found", 404);

  sendSuccessResponseData(res, "notification", notification);
});

module.exports.readNotifications = catchAsync(async (req, res) => {
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw new AppError("Please provide an array of notification IDs", 400);
  }

  // Update all notifications in the `notificationIds` array to set `isRead` to true
  const result = await Notifications.updateMany(
    { _id: { $in: notificationIds } }, // Filter notifications by the provided IDs
    { isRead: true }, // Update `isRead` to true
    { runValidators: true } // Ensure schema validation
  );

  if (result.matchedCount === 0) {
    throw new AppError("No notifications found to update", 404);
  }

  // Retrieve the updated notifications
  const updatedNotifications = await Notifications.find({
    _id: { $in: notificationIds },
  });

  sendSuccessResponseData(res, "message", {
    message: "Notifications updated successfully",
    matchedCount: result.matchedCount, // Number of matched notifications
    modifiedCount: result.modifiedCount, // Number of modified notifications,
    updatedNotifications,
  });
});
module.exports.updateNotification = catchAsync(async (req, res) => {
  const notificationId = req.params.id;

  const notification = await Notifications.findByIdAndUpdate(
    notificationId,
    req.body,
    {
      runValidators: true,
      new: true,
    }
  );

  if (!notification) throw new AppError("Notification could not be found", 404);

  sendSuccessResponseData(res, "notification", notification);
});

module.exports.deleteNotification = catchAsync(async (req, res) => {
  const notificationId = req.params.id;

  const notification = await Notifications.findByIdAndDelete(notificationId);

  if (!notification) throw new AppError("Notification could not be found", 404);

  res.status(200).json({});
});
module.exports.deleteUserNotifications = catchAsync(async (req, res) => {
  // Delete all notifications for the user
  const result = await Notifications.deleteMany({ user: req.user.id });

  if (result.deletedCount === 0)
    throw new AppError("No notifications found to delete", 404);

  res.status(200).json({
    status: "success",
    message: "Notifications deleted successfully",
  });
});
