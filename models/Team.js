const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
    teamId: {
        type: String,
        unique: true
    },
    teamName: {
        type: String,
        required: true
    },
    leaderName: {
        type: String,
        required: true
    },
    leaderMobile: {
        type: String,
        required: true
    },
    member2: String,
    member3: String,

    eventType: {
        type: String,
        required: true
    },

    batch: {
        type: mongoose.Schema.Types.Mixed,  // Allow both numbers and "waiting" string
        default: "waiting"
    },

    batchAssignedAt: Date,

    currentRound: {
        type: Number,
        default: 1
    },

    score: {
        type: Number,
        default: 0
    },

    penalty: {
        type: Number,
        default: 0
    },

    tabSwitchCount: {
        type: Number,
        default: 0
    },

    startTime: Date,
    endTime: Date,
    
    examStartTime: Date,
    examEndTime: Date,
    totalExamTime: Number,

    status: {
        type: String,
        enum: [
            "not_started",
            "active",
            "completed",
            "eliminated",
            "disqualified"
        ],
        default: "not_started"
    },

    registeredAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Team", teamSchema);
