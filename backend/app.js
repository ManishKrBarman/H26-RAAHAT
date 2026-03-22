const express = require("express");
const cors = require("cors");

const trafficRoutes = require("./routes/traffic.routes");
const videoRoutes = require("./routes/video.routes");
const intersectionRoutes = require("./routes/intersection.routes");
const esp32Routes = require("./routes/esp32.routes");
const { isModelHealthy } = require("./services/model.service");

const app = express();

app.use(cors());
app.use(express.json());

// Health check endpoint (used by Docker)
app.get("/health", async (req, res) => {
    const modelOk = await isModelHealthy();
    res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: Date.now(),
        model_server: modelOk ? "connected" : "disconnected"
    });
});

// Routes
app.use("/traffic", trafficRoutes);
app.use("/video", videoRoutes);
app.use("/intersections", intersectionRoutes);
app.use("/esp32", esp32Routes);

module.exports = app;