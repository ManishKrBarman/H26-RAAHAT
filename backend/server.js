const app = require("./app");
const mongoose = require("mongoose");
const { initGridFS } = require("./utils/gridfs");
const { startEngine } = require("./services/signal.engine");

const PORT = 3000;

mongoose.connect("mongodb://127.0.0.1:27017/raahat")
    .then(() => {
        console.log("✅ DB connected");

        // Initialize GridFS after DB connection is ready
        initGridFS();

        // Start the automatic Signal Cycle Engine
        startEngine();

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error("❌ DB connection failed:", err.message);
        process.exit(1);
    });