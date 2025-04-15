const Driver = require("../models/driverModel");
const { catchAsync, sendSuccessResponseData } = require("../utils/helpers");
const APIFEATURES = require("../utils/apiFeatures");
const AppError = require("../utils/appError");

module.exports.getAllDrivers = catchAsync(async (req, res) => {
  const apiFeatures = new APIFEATURES(Driver, req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const totalCount = await Driver.countDocuments();

  const data = await apiFeatures.query;

  sendSuccessResponseData(res, "driver", data, totalCount);
});

module.exports.getDriver = catchAsync(async (req, res) => {
  const driver = await Driver.findById(req.params.id);

  if (!driver) throw new AppError("No Driver was found with that ID", 404);

  sendSuccessResponseData(res, "driver", driver);
});

module.exports.createDriver = catchAsync(async (req, res) => {
  const newDriver = await Driver.create(req.body);
  sendSuccessResponseData(res, "driver", newDriver);
});

module.exports.updateDriver = catchAsync(async (req, res) => {
  // const body = req.user.root ? req.body : { status: req.body.status };

  if (!req.user.root)
    throw new AppError(
      "You do not have permission to edit a driver or change its status with this route. To change a driver status, please use delivery/completed,  delivery/cancelled,"
    );
  const driver = await Driver.findByIdAndUpdate(req.params.id, req.body);
  // Allow all admin to update drivers status

  sendSuccessResponseData(res, "driver", driver);
});

module.exports.deleteDriver = catchAsync(async (req, res) => {
  const driver = await Driver.findById(req.params.id);

  if (!driver) throw new AppError("This driver dosen't exist", 404);

  await Driver.findByIdAndDelete(req.params.id);

  sendSuccessResponseData(res);
});
