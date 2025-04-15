const Delivery = require("../models/deliveryModel");
const Driver = require("../models/driverModel");
const Notifications = require("../models/notificationModel");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");
const Email = require("../utils/email");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");

module.exports.aliasLatestDeliveries = (req, res, next) => {
  req.query.limit = "5";
  req.query.sort = "-createdAt";
  req.query.fields = "firstName,lastName,email,toState,status";
  // req.query.sort = '-ratingsAverage,price';
  // req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};
module.exports.createDelivery = catchAsync(async (req, res) => {
  // Add logic to check available balance before creating a delivery

  const newDelivery = await Delivery.create({ ...req.body, user: req.user.id });

  await Notifications.create({
    user: newDelivery.user,
    title: "Delivery pending!",
    message: "Your package is pending confirmation",
    referenceType: "Delivery",
    referenceId: newDelivery._id,
  });

  sendSuccessResponseData(res, "delivery", newDelivery);
});

module.exports.getAllDelivery = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Delivery, req.query)
    .filter()
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Delivery.countDocuments();

  const deliveries = await apiFeatures.query;

  sendSuccessResponseData(res, "delivery", deliveries, totalCount);
});
module.exports.getAllUserDelivery = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Delivery, req.query)
    .filter({ user: req.user.id })
    .sort()
    .paginate()
    .limitFields();

  const totalCount = await Delivery.countDocuments({ user: req.user.id });

  const deliveries = await apiFeatures.query;

  sendSuccessResponseData(res, "delivery", deliveries, totalCount);
});

module.exports.getDelivery = catchAsync(async (req, res) => {
  const delivery = await Delivery.findOne({
    trackingId: req.params.id,
  }).populate("driver");

  if (!delivery) throw new AppError("Delivery could not be found", 404);

  sendSuccessResponseData(res, "delivery", delivery);
});
module.exports.cancelDelivery = catchAsync(async (req, res) => {
  const { deliveryId } = req.params;
});
module.exports.updateDelivery = catchAsync(async (req, res) => {
  const { status, driver, user, ...rest } = req.body;

  if (driver)
    throw new AppError(
      "This route is not for assigning drivers. Use /assignDriver"
    );

  if (status && req.user.role === "user")
    throw new AppError(
      "You are not permitted to edit the status of a delivery",
      400
    );

  if (status)
    throw new AppError(
      "This route is not meant for status updates. Use /assignDriver, /cancelled, /complete",
      400
    );

  const delivery = await Delivery.findOneAndUpdate(
    { trackingId: req.params.id },
    rest,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!delivery) throw new AppError("Delivery could not be found", 404);

  if (delivery.status !== "unconfirmed" && req.user.role === "user") {
    throw new AppError(
      `You cannot update a ${delivery.status} delivery. Reach out to support if you need assistance.`,
      400
    );
  }

  sendSuccessResponseData(res, "delivery", delivery);
});

module.exports.assignDriver = catchAsync(async (req, res) => {
  const { driverId } = req.body;

  if (!driverId) throw new AppError("Please specify a driver");

  const delivery = await Delivery.findOne({
    trackingId: req.params.id,
  }).populate("user");

  if (!delivery) throw new AppError("Delivery does not exist", 404);

  if (delivery.status !== "unconfirmed")
    throw new AppError(
      `You cannot assign a driver to a ${delivery.status} delivery.`,
      400
    );

  // To assign a driver;
  //1.  Check if the driver exists
  const driver = await Driver.findById(driverId);

  if (!driver) throw new AppError("No Driver was found with that ID", 404);

  //2.  Check if the driver is already assigned to another trip
  const currDelivery = await Delivery.find({
    driver: driverId,
    status: "ongoing",
  });

  console.log(currDelivery);
  //   const driver = await Driver.findOne({ id: driverId, status: "available" });

  if (currDelivery.length)
    throw new AppError("Driver is already assigned to another delivery", 400);

  //3. Update the delivery status to ongoing and assign the driver

  delivery.driver = driverId;
  delivery.status = "ongoing";
  driver.status = "on-duty";

  await driver.save({ validateBeforeSave: true });

  await delivery.save({ validateBeforeSave: true });

  // send email and notification to user that their package has been assigned a driver
  new Email(delivery.user).sendDeliveryOngoing();

  await Notifications.create({
    user: delivery.user,
    title: "Delivery Confirmed!",
    message: "A driver has been assigned, and your package is on its way.",
  });

  sendSuccessResponseData(res, "delivery", delivery);
});

module.exports.completed = catchAsync(async (req, res) => {
  const delivery = await Delivery.findOne({
    trackingId: req.params.id,
  }).populate("user");

  if (delivery.status !== "ongoing")
    throw new AppError(
      `You cannot mark a delivery that is ${delivery.status} as conpleted.`
    );

  const driver = await Driver.findById(delivery.driver);

  if (!driver) throw new AppError("No Driver was found with that ID", 404);

  driver.status = "available";
  delivery.status = "completed";

  await driver.save({ validateBeforeSave: true });

  await delivery.save({ validateBeforeSave: true });

  new Email(delivery.user).sendDeliveryComplete();

  await Notifications.create({
    user: delivery.user,
    title: "Delivery Successful!",
    message:
      "Your package has been delivered. Thank you for choosing our service.",
    status: "success",
  });

  sendSuccessResponseData(res, "delivery", delivery);
});

module.exports.cancelled = catchAsync(async (req, res) => {
  // only unconfirmed and ongoing can be cancelled
  const delivery = await Delivery.findOne({
    trackingId: req.params.id,
  }).populate("user");

  const driverId = delivery.driver;

  if (!delivery) throw new AppError("This delivery dosen't exist", 404);

  if (req.user.role === "admin") {
    // allow admin to cancel deliveries that are already processed but cannot be completed for some reason

    if (delivery.status === "completed")
      throw new AppError(
        "You cannot cancel a delivery that is already marked completed",
        400
      );

    if (driverId) {
      const driver = await Driver.findById(driverId);

      if (!driver) throw new AppError("No Driver was found with that ID", 404);

      delivery.driver = undefined;
      delivery.status = driver.status = "available";

      new Email(delivery.user).sendDeliveryCancelled();

      await Notifications.create({
        user: delivery.user,
        title: "Delivery Cancelled",
        message:
          "We're sorry, but your delivery was cancelled. Please contact support if you need assistance.",
        status: "warning",
      });

      await driver.save({ validateBeforeSave: true });
    }
  } else {
    if (delivery.status !== "unconfirmed") {
      throw new AppError(
        "This delivery has already been processed and cannot be cancelled. If you are sure you want to cancel your delivery contact support.",
        400
      );
    }

    await Notifications.create({
      user: delivery.user,
      title: "Delivery Cancelled",
      message:
        "Your delivery has been successfully cancelled as per your request. Reach out to support if you need further assistance.",
      status: "info",
    });
  }

  // send email and notification

  delivery.status = "cancelled";
  await delivery.save({ validateBeforeSave: true });

  sendSuccessResponseData(res, "delivery", delivery);
});

module.exports.deleteDelivery = catchAsync(async (req, res) => {
  // Only let drivery that are unconfirmed be deleted

  const delivery = await Delivery.findOne({ trackingId: req.params.id });

  if (!delivery) throw new AppError("This delivery dosen't exist", 404);

  if (delivery.status !== "unconfirmed")
    throw new AppError(
      "This delivery has already been processed and cannot be deleted. If you wish to cancel your delivery, please contact support",
      400
    );

  await Delivery.findOneAndDelete({ trackingId: req.params.id });

  sendSuccessResponseData(res);
});
