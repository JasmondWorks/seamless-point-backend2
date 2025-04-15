const mongoose = require("mongoose");
const validator = require("validator");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const phoneNumberRegex = /^\+?[1-9]\d{1,14}$/;

const adminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please tell us your first name"],
    },
    lastName: {
      type: String,
      required: [true, "Please tell us your last name"],
    },
    email: {
      type: String,
      required: [true, "Please provide your email"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },

    phoneNumber: {
      type: String,
      // required: [true, "Please provide your phone number"],
      validate: {
        validator: function (v) {
          return phoneNumberRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    image: String,
    role: { type: String, default: "admin" },
    password: {
      type: String,
      // required: [true, "Please provide a password"],
      minlength: [8, "Password must be at least 8 characters"],
    },
    confirmPassword: {
      type: String,
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords do not match!",
      },
      // required: [true, "Please confirm your password"],
    },
    authType: {
      type: String,
      enum: {
        values: ["credentials", "google", "twitter", "facebook"],
        message:
          "Authtype is either: credentials, google, twitter or facebook ",
      },
    },
    isRoot: { type: Boolean, default: false },

    active: { type: Boolean, default: true, select: false },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
  },
  { timestamps: true }
);

// Pre-save middleware to hash password
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

// Middleware to filter out inactive admins
adminSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

adminSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Method to check if password was changed after the JWT was issued
adminSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return changedTimestamp > JWTTimestamp;
  }
  return false;
};

// Method to create a password reset token
adminSchema.methods.createPasswordResetToken = function () {
  // Create a random token
  const resetToken = crypto.randomBytes(16).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
