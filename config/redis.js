const redis = require("redis");
const client = redis.createClient(); // or use Redis URL

client.connect().then(() => console.log("✅ Connected to Redis"));
