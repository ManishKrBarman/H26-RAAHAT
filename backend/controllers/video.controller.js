const multer = require("multer");
const Video = require("../models/video.model");
const Intersection = require("../models/intersection.model");
const { uploadToGridFS, getDownloadStream } = require("../utils/gridfs");
const { analyzeVideo } = require("../services/model.service");
const { decideSignal } = require("../services/decision.service");
const { updateSignal } = require("../services/signal.controller");

// Multer: store in memory → then push to GridFS
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("video/")) {
            cb(null, true);
        } else {
            cb(new Error("Only video files are allowed"), false);
        }
    }
}).single("video");

/**
 * Upload a video for a specific lane — UPLOAD ONLY, no analysis.
 * POST /video/upload
 */
exports.uploadVideo = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            const { intersection_id, lane_id } = req.body;

            if (!req.file || !intersection_id || !lane_id) {
                return res.status(400).json({
                    error: "video file, intersection_id, and lane_id are required"
                });
            }

            // Verify intersection exists
            const intersection = await Intersection.findOne({ intersection_id });
            if (!intersection) {
                return res.status(404).json({ error: `Intersection '${intersection_id}' not found.` });
            }

            // Verify lane belongs to this intersection
            if (!intersection.lanes.includes(lane_id)) {
                return res.status(400).json({
                    error: `Lane '${lane_id}' doesn't exist. Valid: ${intersection.lanes.join(", ")}`
                });
            }

            // Upload video buffer to GridFS
            const filename = `${intersection_id}_${lane_id}_${Date.now()}_${req.file.originalname}`;
            const fileId = await uploadToGridFS(req.file.buffer, filename, {
                intersection_id,
                lane_id
            });

            // Save video metadata — status stays "uploaded" (NOT processed yet)
            const video = await Video.create({
                intersection_id,
                lane_id,
                file_id: fileId,
                filename,
                mimetype: req.file.mimetype,
                size: req.file.size,
                status: "uploaded"
            });

            console.log(`📹 Video uploaded: ${filename} (${(req.file.size / 1024 / 1024).toFixed(1)}MB)`);

            res.status(201).json({
                message: "Video uploaded. Click 'Analyze' when ready.",
                video: {
                    id: video._id,
                    intersection_id,
                    lane_id,
                    filename,
                    status: "uploaded",
                    size: req.file.size
                }
            });
        } catch (err) {
            console.error("Upload error:", err);
            res.status(500).json({ error: err.message });
        }
    });
};

/**
 * Analyze all uploaded (unprocessed) videos for an intersection.
 * POST /video/analyze/:intersection_id
 * 
 * This is the "Analyze All" button — processes all uploaded videos,
 * then runs the signal decision engine.
 */
exports.analyzeIntersection = async (req, res) => {
    try {
        const { intersection_id } = req.params;

        const intersection = await Intersection.findOne({ intersection_id });
        if (!intersection) {
            return res.status(404).json({ error: "Intersection not found" });
        }

        // Find all unprocessed videos for this intersection
        const unprocessed = await Video.find({
            intersection_id,
            status: "uploaded"
        });

        if (unprocessed.length === 0) {
            // Even with no new uploads, re-run decision on existing analyzed data
            const decision = await runSignalDecision(intersection_id, intersection.lanes);
            return res.json({
                message: "No new videos to process. Re-ran signal decision.",
                processed: 0,
                decision
            });
        }

        console.log(`🔄 Analyzing ${unprocessed.length} videos for ${intersection_id}...`);

        // Process each video
        const results = [];
        for (const video of unprocessed) {
            try {
                await Video.findByIdAndUpdate(video._id, { status: "processing" });

                const analysis = await analyzeVideo(
                    video._id.toString(),
                    intersection_id,
                    video.lane_id
                );

                await Video.findByIdAndUpdate(video._id, {
                    status: "analyzed",
                    analysis,
                    analyzedAt: new Date()
                });

                results.push({ lane: video.lane_id, status: "analyzed", analysis });
                console.log(`  ✅ ${video.lane_id}:`, analysis);
            } catch (err) {
                await Video.findByIdAndUpdate(video._id, {
                    status: "error",
                    error: err.message
                });
                results.push({ lane: video.lane_id, status: "error", error: err.message });
                console.error(`  ❌ ${video.lane_id}:`, err.message);
            }
        }

        // Run signal decision after all videos are processed
        const decision = await runSignalDecision(intersection_id, intersection.lanes);

        res.json({
            message: `Analyzed ${results.length} videos.`,
            processed: results.length,
            results,
            decision
        });

    } catch (err) {
        console.error("Analyze error:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Gather latest analyses per lane and run signal decision engine.
 */
async function runSignalDecision(intersectionId, laneIds) {
    const lanes = [];

    for (const laneId of laneIds) {
        const latestVideo = await Video.findOne({
            intersection_id: intersectionId,
            lane_id: laneId,
            status: "analyzed"
        }).sort({ analyzedAt: -1 });

        if (latestVideo && latestVideo.analysis) {
            lanes.push({
                lane: laneId,
                ...latestVideo.analysis
            });
        }
    }

    if (lanes.length === 0) {
        return { message: "No analyzed data available" };
    }

    const decision = decideSignal(lanes);
    const signal = updateSignal(intersectionId, decision);

    console.log(`🚦 Signal for ${intersectionId}: Lane ${decision.active_lane} (${decision.reason})`);

    return { decision, signal, lanes };
}

/**
 * Get latest video per lane for an intersection
 * GET /video/latest/:intersection_id
 */
exports.getLatestByIntersection = async (req, res) => {
    try {
        const intersection = await Intersection.findOne({
            intersection_id: req.params.intersection_id
        });

        if (!intersection) {
            return res.status(404).json({ error: "Intersection not found" });
        }

        const result = {};
        for (const laneId of intersection.lanes) {
            const latest = await Video.findOne({
                intersection_id: req.params.intersection_id,
                lane_id: laneId
            }).sort({ uploadedAt: -1 });

            result[laneId] = latest || null;
        }

        res.json({
            intersection_id: req.params.intersection_id,
            lanes: result
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get all videos for an intersection
 * GET /video/intersection/:id
 */
exports.getVideosByIntersection = async (req, res) => {
    try {
        const videos = await Video.find({
            intersection_id: req.params.id
        }).sort({ uploadedAt: -1 });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get processing status of a specific video
 * GET /video/status/:id
 */
exports.getVideoStatus = async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }
        res.json({
            id: video._id,
            intersection_id: video.intersection_id,
            lane_id: video.lane_id,
            status: video.status,
            analysis: video.analysis,
            error: video.error
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/**
 * Stream a video file from GridFS
 * GET /video/stream/:id
 */
exports.streamVideo = async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            return res.status(404).json({ error: "Video not found" });
        }

        res.set("Content-Type", video.mimetype);
        res.set("Content-Disposition", `inline; filename="${video.filename}"`);

        const downloadStream = getDownloadStream(video.file_id);
        downloadStream.on("error", () => {
            res.status(404).json({ error: "Video file not found" });
        });
        downloadStream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
