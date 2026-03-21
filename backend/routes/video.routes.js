const express = require("express");
const router = express.Router();

const {
    uploadVideo,
    analyzeIntersection,
    getVideosByIntersection,
    getLatestByIntersection,
    getVideoStatus,
    streamVideo
} = require("../controllers/video.controller");

router.post("/upload", uploadVideo);
router.post("/analyze/:intersection_id", analyzeIntersection);
router.get("/intersection/:id", getVideosByIntersection);
router.get("/latest/:intersection_id", getLatestByIntersection);
router.get("/status/:id", getVideoStatus);
router.get("/stream/:id", streamVideo);

module.exports = router;
