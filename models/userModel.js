const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const phoneNumberRegex = /^\+?[1-9]\d{1,14}$/;

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please provide a first name"],
    },
    lastName: {
      type: String,
      // required: [true, "Please provide a last name"],
    },
    phoneNumber: {
      type: String,
      unique: true,
      required: [true, "Please provide your phone number"],
      validate: {
        validator: function (v) {
          return phoneNumberRegex.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    dob: {
      type: Date,
      // required: [true, "Please provide a DOB"],
    },
    gender: {
      type: String,
      enum: {
        values: ["Male", "Female"],
        message: "Gender is either: Male or Female",
      },
    },
    email: {
      type: String,
      validate: [validator.isEmail, "Please provide a valid email"],

      required: [true, "Please provide a valid email"],
      unique: true,
    },
    authType: {
      type: String,
      enum: {
        values: ["credentials", "google", "twitter", "facebook"],
        message:
          "Authtype is either: credentials, google, twitter or facebook ",
      },
      default: "credentials",
      required: [true, "Please specify the authType"],
    },
    balance: {
      type: Number,
      default: 0,
    },
    city: {
      type: String,
    },
    street: {
      type: String,
    },
    streetNumber: {
      type: String,
    },
    role: { type: String, default: "user" },
    password: {
      type: String,
      required: [true, "Please provide a password"],
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
      required: this.isNew,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpires: Date,
    latestTokenAssignedAt: Date,
    active: {
      type: Boolean,
      default: true,
      select: false,
    },
  },
  { timestamps: true }
);

userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);

  this.confirmPassword = undefined;
  this.passwordChangedAt = new Date(Date.now() - 1000);
  next();
});

userSchema.methods.checkLatestToken = function (JWT_TIMESTAMP) {
  const tokenAssignedAtTimeStamp = parseInt(
    (this.latestTokenAssignedAt.getTime() / 1000).toString(),
    10
  );

  return tokenAssignedAtTimeStamp == JWT_TIMESTAMP;
};

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  console.log(candidatePassword);
  console.log(userPassword);
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      (this.passwordChangedAt.getTime() / 1000).toString(),
      10
    );
    return changedTimestamp > JWTTimestamp;
  }

  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  // create a random token
  const resetToken = crypto.randomBytes(32 / 2).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// Create the User model
const User = mongoose.model("User", userSchema);

module.exports = User;
