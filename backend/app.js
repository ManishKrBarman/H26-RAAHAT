const express = require("express");
const cors = require("cors");

const trafficRoutes = require("./routes/traffic.routes");
const videoRoutes = require("./routes/video.routes");
const intersectionRoutes = require("./routes/intersection.routes");
const esp32Routes = require("./routes/esp32.routes");

const app = express();

// CORS: configurable via CORS_ORIGIN env var (comma-separated origins)
// If not set, allows all origins (suitable for development)
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map(s => s.trim()) } : {}));
app.use(express.json());

// Health check endpoint (used by Docker)
app.get("/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// Routes
app.use("/traffic", trafficRoutes);
app.use("/video", videoRoutes);
app.use("/intersections", intersectionRoutes);
app.use("/esp32", esp32Routes);

module.exports = app;