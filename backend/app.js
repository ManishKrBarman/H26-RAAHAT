const express = require("express");
const cors = require("cors");

const trafficRoutes = require("./routes/traffic.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/traffic", trafficRoutes);

module.exports = app;