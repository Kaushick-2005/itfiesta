const mongoose = require("mongoose");

const batchControlSchema = new mongoose.Schema({
    event: {
        type: String,
        required: true,
        unique: true
    },
    currentBatchNumber: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: false
    },
    startedAt: Date,
    endedAt: Date
});

module.exports = mongoose.model("BatchControl", batchControlSchema);