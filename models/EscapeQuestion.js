const mongoose = require("mongoose");

const escapeQuestionSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true
    },
    category: String,
    type: {
        type: String,
        enum: ["mcq", "fill", "code", "puzzle"],
        default: "mcq"
    },
    question: {
        type: String,
        required: true
    },
    options: [String],
    answer: mongoose.Schema.Types.Mixed,
    marks: {
        type: Number,
        default: 10
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { strict: false });

module.exports = mongoose.model("EscapeQuestion", escapeQuestionSchema);
