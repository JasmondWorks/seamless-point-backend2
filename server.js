require("dotenv").config();
const app = require("./app");
const mongoose = require("mongoose");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

// dotenv.config({ path: `${__dirname}/config.env` });
// dotenv.config();

// const DB = process.env.DATABASE?.replace(
//   "<PASSWORD>",
//   process.env.DATABASE_PASSWORD || ""
// );
// const DB = process.env.DATABASE;

// mongoose
//   .connect(DB
//     // , { useUnifiedTopology: true, useNewUrlParser: true }
//   )
//   .then(() => {
//     console.log(`MongoDB Connected`);
//   })
//   .catch((error) => {
//     console.error(`Error: ${error.message}`);
//     process.exit(1);
//   });
// mongoose.set("useFindAndModify", false);
(async () => {
  try {
    await mongoose.connect(process.env.DATABASE);
    console.log('DB connected');
  } catch (err) {
    console.log('DB error :::::::', err);
    process.exit(1);
  }
})();

// Server Port
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! 💥 Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
