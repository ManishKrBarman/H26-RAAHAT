/**
 * gridfs.js — MongoDB GridFS setup for video storage
 *
 * Videos are stored as binary chunks in MongoDB instead of the local filesystem.
 * This module initializes GridFS once the Mongoose connection is ready.
 */

const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let bucket = null;

/**
 * Initialize GridFS bucket. Call this after mongoose.connect() resolves.
 */
function initGridFS() {
    const db = mongoose.connection.db;
    bucket = new GridFSBucket(db, { bucketName: "videos" });
    console.log("[OK] GridFS 'videos' bucket initialized");
}

/**
 * Get the GridFS bucket. Throws if not initialized.
 */
function getBucket() {
    if (!bucket) {
        throw new Error("GridFS not initialized. Call initGridFS() after DB connects.");
    }
    return bucket;
}

/**
 * Upload a buffer to GridFS and return the file ID.
 */
async function uploadToGridFS(buffer, filename, metadata = {}) {
    const bucket = getBucket();

    return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(filename, { metadata });

        uploadStream.on("finish", () => {
            resolve(uploadStream.id);
        });

        uploadStream.on("error", (err) => {
            reject(err);
        });

        uploadStream.end(buffer);
    });
}

/**
 * Get a readable stream for a file from GridFS by file ID.
 */
function getDownloadStream(fileId) {
    const bucket = getBucket();
    return bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
}

/**
 * Delete a file from GridFS by file ID.
 */
async function deleteFromGridFS(fileId) {
    const bucket = getBucket();
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
}

module.exports = {
    initGridFS,
    getBucket,
    uploadToGridFS,
    getDownloadStream,
    deleteFromGridFS
};
