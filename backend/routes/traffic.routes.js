const express = require("express");
const router = express.Router();

const {
    analyzeTraffic,
    getCurrent,
    getHistory
} = require("../controllers/traffic.controller");

router.post("/analyze", analyzeTraffic);
router.get("/current", getCurrent);
router.get("/history", getHistory);
router.post("/manual", manualControl);

module.exports = router;