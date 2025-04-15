// validator.js
const { parsePhoneNumberFromString } = require("libphonenumber-js");

function validateMobileNumber(number, countryCode = "234") {
  const phoneNumber = parsePhoneNumberFromString(number, countryCode);
  if (phoneNumber && phoneNumber.isValid()) {
    console.log("here");
    return {
      isValid: true,
      normalizedNumber: phoneNumber.number, // normalized number
    };
  }
  return {
    isValid: false,
    normalizedNumber: null,
  };
}

module.exports = validateMobileNumber;
