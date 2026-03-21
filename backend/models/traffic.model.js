const mongoose = require("mongoose");

const TrafficSchema = new mongoose.Schema({
    lanes: Array,
    decision: Object,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Traffic", TrafficSchema);