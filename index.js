const mqtt = require("mqtt");
const axios = require("axios");
const http = require("http");

// ─────────────────────────────────────────
const FIREBASE_DB_URL =
  "https://mycuetbus-default-rtdb.asia-southeast1.firebasedatabase.app";
const MQTT_BROKER = "mqtt://mqtt-dashboard.com";
const TOPIC = "GPS_Tracking_Data";
// ─────────────────────────────────────────

// HTTP server — keeps Render awake
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("MyCUETBus MQTT Bridge Running ✅");
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`🌐 HTTP server on port ${process.env.PORT || 3000}`);
  });

console.log("🚀 Starting MyCUETBus MQTT Bridge...");

const client = mqtt.connect(MQTT_BROKER, {
  clientId: "MyCUETBus_Bridge_" + Math.random().toString(16).substr(2, 8),
  clean: true,
  reconnectPeriod: 5000,
  connectTimeout: 30000,
  keepalive: 60,
});

client.on("connect", () => {
  console.log("✅ Connected to MQTT:", MQTT_BROKER);
  client.subscribe(TOPIC, (err) => {
    if (err) console.error("❌ Subscribe failed:", err.message);
    else console.log("✅ Subscribed to:", TOPIC);
  });
});

client.on("message", async (topic, message) => {
  try {
    const raw = message.toString();
    const gpsData = JSON.parse(raw);

    const {
      latitude,
      longitude,
      timestamp,
      speed,
      heading,
      accuracy,
      deviceType,
      sharedBy,
      satelliteCount,
    } = gpsData;

    if (!latitude || !longitude) {
      console.warn("⚠️ Missing coordinates — skipping");
      return;
    }

    const busName = sharedBy || "GPS_Tracker";
    const firebaseUrl = `${FIREBASE_DB_URL}/buses/${busName}.json`;

    await axios.put(firebaseUrl, {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      timestamp: Date.now(),
      speed: parseFloat(speed) || 0,
      heading: parseFloat(heading) || 0,
      accuracy: parseFloat(accuracy) || 5,
      deviceType: deviceType || "gps_tracker",
      sharedBy: busName,
      satelliteCount: parseInt(satelliteCount) || 0,
    });

    console.log(
      `✅ Firebase updated [${busName}] lat:${latitude} lng:${longitude}`,
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
});

client.on("error", (err) => console.error("❌ MQTT error:", err.message));
client.on("reconnect", () => console.log("🔄 Reconnecting to MQTT..."));
client.on("offline", () => console.log("⚠️ MQTT offline"));
client.on("close", () => console.log("🔌 MQTT connection closed"));

process.on("uncaughtException", (err) =>
  console.error("Uncaught:", err.message),
);
process.on("unhandledRejection", (err) =>
  console.error("Unhandled:", err.message),
);
