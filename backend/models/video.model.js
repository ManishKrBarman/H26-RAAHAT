const mongoose = require("mongoose");

const VideoSchema = new mongoose.Schema({
    intersection_id: {
        type: String,
        required: true,
        index: true
    },
    lane_id: {
        type: String,
        required: true
    },
    // GridFS file ID — the actual video binary is stored in GridFS
    file_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        default: "video/mp4"
    },
    size: {
        type: Number // bytes
    },

    // Processing status
    status: {
        type: String,
        enum: ["uploaded", "processing", "analyzed", "error"],
        default: "uploaded"
    },

    // AI model analysis results (filled after processing)
    analysis: {
        vehicle_count: Number,
        avg_speed: Number,
        density: {
            type: String,
            enum: ["low", "medium", "high", "critical"]
        },
        emergency: {
            type: Boolean,
            default: false
        },
        // Audio analysis fields
        audio_used: {
            type: Boolean,
            default: false
        },
        video_score: Number,
        audio_score: Number,
        final_score: Number
    },

    error: {
        type: String,
        default: null
    },

    uploadedAt: {
        type: Date,
        default: Date.now
    },
    analyzedAt: {
        type: Date
    }
});

// Compound index: quickly find latest video per intersection + lane
VideoSchema.index({ intersection_id: 1, lane_id: 1, uploadedAt: -1 });

module.exports = mongoose.model("Video", VideoSchema);
