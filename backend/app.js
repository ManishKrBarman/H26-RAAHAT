const express = require("express");
const cors = require("cors");

const trafficRoutes = require("./routes/traffic.routes");
const videoRoutes = require("./routes/video.routes");
const intersectionRoutes = require("./routes/intersection.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint (used by Docker)
app.get("/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

// Routes
app.use("/traffic", trafficRoutes);
app.use("/video", videoRoutes);
app.use("/intersections", intersectionRoutes);

module.exports = app;