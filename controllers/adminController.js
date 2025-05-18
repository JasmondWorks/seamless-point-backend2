const Admin = require("../models/adminModel");
const AppError = require("../utils/appError");
const {
  catchAsync,
  sendSuccessResponseData,
  filterObj,
} = require("../utils/helpers");

module.exports.getAdmin = catchAsync(async function (req, res) {
  const user = await Admin.findById(req.user._id);
  if (!user) throw new AppError("No user was found", 404);

  sendSuccessResponseData(res, "user", user);
});

module.exports.updateMe = catchAsync(async (req, res) => {
  // 1) Throw error if user Post password data
  if (req.body.password || req.body.passwordConfirm)
    throw new AppError(
      "This route is not for password updates. Please use /updateMyPassword",
      400
    );

  // 2) We dont want to update the email and name and other sensitive info
  const filteredBody = filterObj(
    req.body,
    "dob",
    "lastName",
    "firstName",
    "gender",
    "profileImage"
  );

  const updatedUser = await Admin.findByIdAndUpdate(
    req.user._id,
    filteredBody,
    {
      new: true,
      runValidators: true,
    }
  );
  console.log(updatedUser);
  sendSuccessResponseData(res, "user", updatedUser);
});
