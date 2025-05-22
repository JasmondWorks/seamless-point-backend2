const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const globalErrorHandler = require("./controllers/errorController");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const helmet = require("helmet");
const hpp = require("hpp");
const AppError = require("./utils/appError");

const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const driverRoutes = require("./routes/driverRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const shipmentRoutes = require("./routes/shipmentRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const terminalRoutes = require("./routes/terminalRoutes");
const { fetchAllHSCodes } = require("./utils/terminal");

const app = express();

app.use(cors());

app.use(helmet());

app.use(cookieParser());

app.use(express.json());

app.use(bodyParser.json({ limit: "10kb" }));

app.use(mongoSanitize());

app.use(
  hpp({
    whitelist: [],
  })
);

app.use(express.static(`${__dirname}/public`));

app.use((req, _, next) => {
  req.rawBody = "";
  req.on("data", (chunk) => {
    req.rawBody += chunk;
  });
  next();
});

async function main() {
  try {
    await fetchAllHSCodes();
    console.log("✅ Finished fetching HS codes.");
    process.exit(0); // Exit successfully
  } catch (error) {
    console.error("❌ Failed to fetch HS codes:", error.message || error);
    process.exit(1); // Exit with failure
  }
}

// main();
// Routes
app.get("/", (_, res) => {
  res.send("Welcome to the Seamless Point API");
});
app.use("/api/v1/users", userRoutes);

app.use("/api/v1/admins", adminRoutes);

app.use("/api/v1/deliveries", deliveryRoutes);

app.use("/api/v1/drivers", driverRoutes);

app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/transactions", transactionRoutes);
app.use("/api/v1/shipment", shipmentRoutes);
app.use("/api/v1/tracking", trackingRoutes);
app.use("/api/v1/webhook", webhookRoutes);
app.use("/api/v1/terminal", terminalRoutes);

app.get("/", (_req, res) => {
  res.send("<h1>Deployment Check</h1>");
});

app.get("*", (req, _res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
