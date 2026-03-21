const express = require("express");
const router = express.Router();

const {
    analyzeTraffic,
    getCurrent,
    getHistory,
    manualControl,
    getSignalStatus
} = require("../controllers/traffic.controller");

router.post("/analyze", analyzeTraffic);
router.get("/current", getCurrent);
router.get("/history", getHistory);
router.post("/manual", manualControl);
router.get("/signal/:intersection_id", getSignalStatus);

module.exports = router;