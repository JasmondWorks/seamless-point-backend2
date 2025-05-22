const crypto = require("crypto");
const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const { catchAsync } = require("../utils/helpers");
const AppError = require("../utils/appError");
const { verifyJwt } = require("../utils/jwt.js");
const Email = require("../utils/email");

const { createSendToken } = require("../utils/helpers");
const { FRONTEND_URL } = require("../utils/const.js");

exports.authenticate = catchAsync(async (req, _res, next) => {
  let token =
    (req.headers.authorization?.startsWith("Bearer") &&
      req.headers.authorization.split(" ")[1]) ||
    (req.headers.cookie?.startsWith("jwt") &&
    typeof req.headers.cookie === "string"
      ? req.headers.cookie.split("=")[1]
      : undefined);

  if (token === "null" || !token)
    throw new AppError("You are not logged in! Please log in", 401);

  const decoded = await verifyJwt(token);

  const freshUser =
    (await User.findById(decoded.id).select("+role")) ||
    (await Admin.findById(decoded.id).select("+role"));

  if (!freshUser)
    throw new AppError("The user belonging to this token does not exist.", 401);

  if (freshUser.changePasswordAfter(decoded.iat))
    throw new AppError(
      "User recently changed password! Please log in again",
      401
    );

  req.user = freshUser;

  next();
});

exports.authorize = (...roles) =>
  catchAsync(async (req, _res, next) => {
    if (!roles.includes(req.user.role))
      throw new AppError(
        "You do not have permission to perform this action",
        403
      );

    next();
  });

exports.verifyToken = (_req, res) => {
  res.status(200).json({
    status: "success",
    message: "Successfully authenticated",
  });
};

exports.authenicateAdmin = catchAsync(async (req, res) => {
  let token =
    (req.headers.authorization?.startsWith("Bearer") &&
      req.headers.authorization.split(" ")[1]) ||
    (req.headers.cookie?.startsWith("jwt") &&
    typeof req.headers.cookie === "string"
      ? req.headers.cookie.split("=")[1]
      : undefined);

  if (token === "null" || !token)
    throw new AppError("You are not logged in! Please log in", 401);

  const decoded = await verifyJwt(token);

  const freshUser = await Admin.findById(decoded.id);

  if (!freshUser)
    throw new AppError("The user belonging to this token does not exist.", 401);

  if (freshUser.changePasswordAfter(decoded.iat))
    throw new AppError(
      "User recently changed password! Please log in again",
      401
    );

  res.status(200).json({
    status: "success",
    message: "Admin successfully authenticated",
  });
});

exports.authenticateUser = catchAsync(async (req, res) => {
  let token =
    (req.headers.authorization?.startsWith("Bearer") &&
      req.headers.authorization.split(" ")[1]) ||
    (req.headers.cookie?.startsWith("jwt") &&
    typeof req.headers.cookie === "string"
      ? req.headers.cookie.split("=")[1]
      : undefined);

  if (token === "null" || !token)
    throw new AppError("You are not logged in! Please log in", 401);

  const decoded = await verifyJwt(token);

  const freshUser = await User.findById(decoded.id);

  if (!freshUser)
    throw new AppError("The user belonging to this token does not exist.", 401);

  if (freshUser.changePasswordAfter(decoded.iat))
    throw new AppError(
      "User recently changed password! Please log in again",
      401
    );

  res.status(200).json({
    status: "success",
    message: "User Successfully authenticated",
  });
});

exports.authorizeRootAdmin = catchAsync(async (req, _res, next) => {
  if (!req.user.isRoot)
    throw new AppError(
      "You do not have the priviledge as root admin to perform this action"
    );

  next();
});

exports.getUser = catchAsync(async (req, res) => {
  if (!req.body.email) throw new AppError("Please provide an email", 400);
  const user = await User.findOne({ email: req.body.email });
  if (!user) throw new AppError("User does not exist", 404);
  res.status(200).json({
    message: "success",
    data: { user },
  });
});

module.exports.userSignIn = catchAsync(async function (req, res) {
  let user = await User.findOne({
    email: req.body.email,
    authType: "credentials",
  });

  if (user)
    throw new AppError(
      "You are already signed up with credentials. Please login with your credentials",
      400
    );

  user = await User.findOne({
    email: req.body.email,
  });

  if (!user) {
    user = await new User(req.body).save({
      validateBeforeSave: false,
    });

    new Email(user).sendWelcome();
  }

  createSendToken(user, 200, res);
});

exports.userLogin = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new AppError("Please provide email and password", 400);

  let user = await User.findOne({
    email,
    authType: { $ne: "credentials" },
  });

  if (user)
    throw new AppError(
      `You are already signed up with ${user.authType}. Please sign in with ${user.authType}`,
      400
    );

  user = await User.findOne({ email, authType: "credentials" }).select(
    "+password"
  );

  if (!user || !(await user.correctPassword(password, user.password)))
    throw new AppError("Incorrect email or password", 401);

  await createSendToken(user, 200, res);
});

exports.userSignUp = catchAsync(async (req, res) => {
  const { email, phoneNumber } = req.body;

  let user = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (user) {
    if (user.email === email && user.authType === "credentials") {
      throw new AppError("Email already registered. Please log in", 409);
    }

    if (user.email === email && user.authType !== "credentials") {
      throw new AppError(
        `Email already registered. Please sign in using ${user.authType}`,
        409
      );
    }

    if (user.phoneNumber === phoneNumber) {
      throw new AppError("Phone number already in use", 409);
    }
  }

  const newUser = await User.create({ ...req.body, authType: "credentials" });

  user = await User.findById(newUser._id);

  new Email(user).sendWelcome();

  createSendToken(user, 201, res);
});

exports.adminSignUp = catchAsync(async (req, res) => {
  let admin = await Admin.findOne({ email: req.body.email });

  if (admin && admin.authType === "credentials")
    throw new AppError("Account already registered. Please log in", 409);

  if (admin && admin.authType !== "credentials")
    throw new AppError(
      `Account already registered. Please sign in using ${admin.authType}`,
      409
    );

  const { password, confirmPassword, phoneNumber } = req.body;
  if (!password || !confirmPassword)
    throw new AppError("Password and confirm password are compulsory", 400);
  if (!phoneNumber) throw new AppError("Please provide your phone number", 400);

  const existingAdmins = await Admin.find();
  const isRoot = !existingAdmins.length ? true : false;

  const newAdmin = await Admin.create({
    ...req.body,
    authType: "credentials",
    isRoot,
  });

  createSendToken(newAdmin, 201, res);
});

module.exports.adminSignIn = catchAsync(async function (req, res) {
  let admin = await Admin.findOne({
    email: req.body.email,
    authType: "credentials",
  });

  if (admin)
    throw new AppError(
      "You are already signed up with credentials. Please login with your credentials",
      400
    );

  admin = await Admin.findOne({
    email: req.body.email,
  });

  if (!admin)
    admin = await new Admin(req.body).save({
      // validateBeforeSave: false,
    });

  createSendToken(admin, 200, res);
});

exports.adminLogin = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    throw new AppError("Please provide email and password!", 400);

  const admin = await Admin.findOne({ email, authType: "credentials" }).select(
    "+password"
  );

  if (!admin || !(await admin.correctPassword(password, admin.password)))
    throw new AppError("Incorrect email or password", 401);

  createSendToken(admin, 200, res);
});

module.exports.forgotUserPassword = catchAsync(async function (req, res) {
  // find the userId based on email
  const { email } = req.body;
  if (!email) throw new AppError("Please provide an email", 400);

  const user = await User.findOne({ email });

  if (user && user.authType !== "credentials") {
    throw new AppError(
      `Your account is registered using ${user.authType}. Password reset is only available for accounts with 'credentials' authentication.`,
      400
    );
  }

  if (!user) throw new AppError("There is no user with email", 404);

  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  const resetURL = `${FRONTEND_URL}/auth/user/reset-password?token=${resetToken}`;

  await new Email(user).sendResetToken(resetURL);

  res.status(200).json({
    status: "success",
    message: "Reset token sent to your email!",
  });
});

exports.resetUserPassword = catchAsync(async (req, res) => {
  const { password, confirmPassword } = req.body;
  const token = req.query.token;
  if (!token) throw new AppError("Please provide a token", 400);
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  });

  if (!user) throw new AppError("Token is invalid or has expired!", 400);

  if (!password) throw new AppError("Please provide your password", 400);

  if (!confirmPassword)
    throw new AppError("Please confirm your new password", 400);

  // if (!(await user.correctPassword(currPassword, user.password))) {
  //   throw new AppError("Password is incorrect", 400);
  // }
  if (await user.correctPassword(password, user.password)) {
    throw new AppError("New password cannot be the same as old password", 400);
  }

  user.password = password;
  user.confirmPassword = confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  await user.save({ validateBeforeSave: true });

  createSendToken(user, 200, res);
});

module.exports.forgotAdminPassword = catchAsync(async function (req, res) {
  // find the userId based on email
  const { email } = req.body;
  if (!email) throw new AppError("Please provide an email", 400);

  const admin = await Admin.findOne({ email });

  if (admin && admin.authType !== "credentials") {
    throw new AppError(
      `Your account is registered using ${admin.authType}. Password reset is only available for accounts with 'credentials' authentication.`,
      400
    );
  }

  if (!admin) throw new AppError("There is no user with this email", 404);

  const resetToken = admin.createPasswordResetToken();

  await admin.save({ validateBeforeSave: false });

  // if user found
  // send them a reset token.
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  // try {
  //   await sendEmail({
  //     email: guest.email,
  //     subject: "Your password reset token (valid for 10 min)",
  //     message,
  //   });

  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
  // } catch (err) {
  //   console.log(err);
  //   guest.passwordResetToken = undefined;
  //   guest.passwordResetTokenExpires = undefined;
  //   await guest.save();

  //   throw new AppError(
  //     "There was an error sending the email. Try again later!",
  //     500
  //   );
  // }
});

exports.resetAdminPassword = catchAsync(async (req, res) => {
  const { password, confirmPassword } = req.body;
  const token = req.query.token;
  if (!token) throw new AppError("Please provide a token", 400);

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const admin = await Admin.findOne({
    passwordResetToken: hashedToken,
    passwordResetTokenExpires: { $gt: Date.now() },
  });

  if (!admin) throw new AppError("Token is invalid or has expired!", 400);

  if (!password) throw new AppError("Please provide your password", 400);

  if (!confirmPassword)
    throw new AppError("Please confirm your new password", 400);

  // if (!(await user.correctPassword(currPassword, user.password))) {
  //   throw new AppError("Password is incorrect", 400);
  // }
  if (await admin.correctPassword(password, admin.password)) {
    throw new AppError("New password cannot be the same as old password", 400);
  }

  admin.password = password;
  admin.confirmPassword = confirmPassword;
  admin.passwordResetToken = undefined;
  admin.passwordResetTokenExpires = undefined;
  await admin.save({ validateBeforeSave: true });

  createSendToken(admin, 200, res);
});

exports.updateMyPassword = catchAsync(async (req, res) => {
  let user;
  if (req.user.role === "user") {
    user = await User.findById(req.user.id).select("+password");
  } else if (req.user.role === "admin") {
    user = await Admin.findById(req.user.id).select("+password");
  }

  if (user && user.authType !== "credentials") {
    throw new AppError(
      `Your account is registered using ${user.authType}. Update password is only available for accounts with 'credentials' authentication.`,
      400
    );
  }
  if (!user) throw new AppError("User not found", 404);

  const { currPassword, password, confirmPassword } = req.body;

  if (!currPassword)
    throw new AppError("Please provide your current password", 400);

  if (!password) throw new AppError("Please provide your new password", 400);

  if (!confirmPassword)
    throw new AppError("Please confirm your new password", 400);

  if (!(await user.correctPassword(currPassword, user.password))) {
    throw new AppError("Password is incorrect", 400);
  }
  if (await user.correctPassword(password, user.password)) {
    throw new AppError("New password cannot be the same as old password", 400);
  }
  user.password = password;
  user.confirmPassword = confirmPassword;
  await user.save({ validateBeforeSave: true });

  createSendToken(user, 200, res);
});

exports.refreshToken = catchAsync(async (req, res) => {
  const user = await User.findById(req.user.id);
  createSendToken(user, 200, res);
});
