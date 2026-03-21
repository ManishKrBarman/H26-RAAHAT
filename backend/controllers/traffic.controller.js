const { decideSignal } = require("../services/decision.service");
const Traffic = require("../models/traffic.model");
const { manualOverride } = require("../services/signal.controller");
const { fakeAI } = require("../utils/fakeAI");

let currentState = { intersections: [] };

// setInterval(async () => {
//     const lanes = ["A", "B", "C", "D"].map(fakeAI);

//     const decision = decideSignal(lanes);
//     currentState = {
//         ...decision,
//         lanes
//     };

//     await Traffic.create({
//         lanes,
//         decision
//     });

//     console.log("Saved + Updated:", decision);
// }, 3000);

// exports.analyzeTraffic = async (req, res) => {
//     const { lanes } = req.body;

//     const decision = decideSignal(lanes);
//     currentState = decision;

//     await Traffic.create({
//         lanes,
//         decision
//     });

//     res.json(decision);
// };

const {
    updateSignal,
    getCurrentSignal
} = require("../services/signal.controller");


exports.analyzeTraffic = async (req, res) => {
    const { intersections } = req.body;

    if (!intersections) {
        return res.status(400).json({ error: "Intersections required" });
    }

    // 🧠 Decision per intersection
    const result = intersections.map(int => {
        const decision = decideSignal(int.lanes);

        const signal = updateSignal(decision);

        return {
            ...int,
            decision,
            signal
        };
    });

    currentState = { intersections: result };

    await Traffic.create(currentState);

    console.log("Updated State:", currentState);

    res.json(currentState);
};

exports.getHistory = async (req, res) => {
    const data = await Traffic.find().sort({ createdAt: -1 }).limit(10);
    res.json(data);
};

exports.getCurrent = (req, res) => {
    res.json(currentState);
};

exports.manualControl = (req, res) => {
    const { lane, duration } = req.body;

    if (!lane || !duration) {
        return res.status(400).json({ error: "Lane and duration required" });
    }

    const signal = manualOverride(lane, duration);
    res.json(signal);
};