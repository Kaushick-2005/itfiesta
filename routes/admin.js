const express = require("express");
const router = express.Router();
const Team = require("../models/Team");
const BatchControl = require("../models/BatchControl");
const Settings = require("../models/Settings");

function normalizeTeamStatus(doc) {
    const team = doc && (doc.toObject ? doc.toObject() : { ...doc });
    const eventKey = String(team.eventType || "").toLowerCase();
    const maxRound = eventKey === "escape" ? 5 : 3;
    const currentRound = Number(team.currentRound || 1);
    const rawStatus = String(team.status || "not_started").toLowerCase();

    // Keep disqualification/elimination authoritative.
    if (rawStatus === "eliminated" || rawStatus === "disqualified") {
        team.status = rawStatus;
        return team;
    }

    // Treat legacy labels as active.
    const normalizedRaw = rawStatus === "in_progress" ? "active" : rawStatus;

    // Derive completion from progression/timestamps so stale DB status
    // does not show active/in-progress after finishing.
    const hasCompletionMarker = Boolean(
        team.examEndTime ||
        team.endTime ||
        (typeof team.totalExamTime === "number" && team.totalExamTime > 0)
    );

    if (currentRound > maxRound || hasCompletionMarker) {
        team.status = "completed";
    } else {
        team.status = normalizedRaw;
    }

    return team;
}


/* ===============================
    BATCH CONTROL ROUTES
================================= */

/* Start Batch (Auto Assign Waiting Teams) */
router.post("/batch/start", async (req, res) => {
    try {
        const { event } = req.body;

        let batch = await BatchControl.findOne({ event });

        const nextBatch = batch ? batch.currentBatchNumber + 1 : 1;

        await BatchControl.updateOne(
            { event },
            {
                $set: {
                    event,
                    currentBatchNumber: nextBatch,
                    isActive: true,
                    startedAt: new Date()
                }
            },
            { upsert: true }
        );

        // Move all waiting teams into new batch
        const waitingTeams = await Team.updateMany(
            { eventType: event, batch: "waiting" },
            { 
                $set: { 
                    batch: nextBatch,
                    batchAssignedAt: new Date()
                }
            }
        );

        res.json({
            success: true,
            batch: nextBatch,
            teamsAssigned: waitingTeams.modifiedCount
        });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/* Stop Batch */
router.post("/batch/stop", async (req, res) => {
    try {
        const { event } = req.body;

        await BatchControl.updateOne(
            { event },
            { $set: { isActive: false } }
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/* Reset Batch */
router.post("/batch/reset", async (req, res) => {
    try {
        const { event } = req.body;

        await BatchControl.updateOne(
            { event },
            {
                $set: {
                    currentBatchNumber: 0,
                    isActive: false
                }
            }
        );

        // Set all teams back to waiting
        await Team.updateMany(
            { eventType: event },
            { 
                $set: { batch: "waiting" },
                $unset: { batchAssignedAt: "" }
            }
        );

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/* Get Batch Status */
router.get("/batch/status/:event", async (req, res) => {
    try {
        const { event } = req.params;
        
        const batch = await BatchControl.findOne({ event });
        
        if (!batch) {
            return res.json({
                event,
                currentBatchNumber: 0,
                isActive: false,
                message: "No batch created yet"
            });
        }

        res.json(batch);

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/* ===============================
   1️⃣ Get Teams (With Filters)
================================= */
router.get("/teams", async (req, res) => {
    try {

        const { eventType, status, batch } = req.query;

        let filter = {};

        if (eventType) filter.eventType = eventType;
        if (batch !== undefined) filter.batch = batch === 'null' ? null : Number(batch);

        const teams = await Team.find(filter).sort({ score: -1, registeredAt: 1 });

        let normalized = teams.map(normalizeTeamStatus);

        if (status) {
            const statusQuery = String(status).toLowerCase();
            normalized = normalized.filter((team) => String(team.status || "").toLowerCase() === statusQuery);
        }

        res.json(normalized);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   2️⃣ Edit Score
================================= */
router.patch("/edit-score/:id", async (req, res) => {
    try {

        const { score } = req.body;

        await Team.findByIdAndUpdate(req.params.id, {
            score: Number(score)
        });

        res.json({ message: "Score updated" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   4️⃣ Change Status
================================= */
router.patch("/status/:id", async (req, res) => {
    try {

        const { status } = req.body;

        await Team.findByIdAndUpdate(req.params.id, {
            status: status
        });

        res.json({ message: "Status updated" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   5️⃣ Start All Teams (by Event)
================================= */
router.patch("/start-event", async (req, res) => {
    try {

        const { eventType } = req.body;

        await Team.updateMany(
            { eventType },
            {
                status: "active",
                startTime: new Date()
            }
        );

        res.json({ message: "Event started" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   6️⃣ End All Teams (by Event)
================================= */
router.patch("/end-event", async (req, res) => {
    try {

        const { eventType } = req.body;

        await Team.updateMany(
            { eventType },
            {
                status: "completed",
                endTime: new Date()
            }
        );

        res.json({ message: "Event ended" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   🏆 Leaderboard
================================= */
router.get("/leaderboard/:eventType", async (req, res) => {
    try {
        const { eventType } = req.params;
        const { batch } = req.query;

        let filter = { eventType };
        
        // If batch specified, filter by batch number
        if (batch !== undefined) {
            filter.batch = batch === 'null' ? null : Number(batch);
        }

        const teams = await Team.find(filter).sort({ 
            score: -1, 
            totalExamTime: 1,
            registeredAt: 1 
        });

        const normalized = teams.map(normalizeTeamStatus);

        res.json(normalized);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

/* Get All Leaderboards */
router.get("/leaderboard", async (req, res) => {
    try {
        const teams = await Team.find().sort({ 
            score: -1, 
            totalExamTime: 1,
            registeredAt: 1 
        });

        res.json(teams);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

/* ===============================
    Advance Team to Next Round/Level
================================= */
router.patch("/next-round/:id", async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        const currentRound = team.currentRound || 1;
        const maxRound = team.eventType === 'escape' ? 5 : 3;

        if (currentRound >= maxRound) {
            team.currentRound = maxRound + 1;
            team.status = "completed";
        } else {
            team.currentRound = currentRound + 1;
        }

        await team.save();
        res.json({ 
            message: "Team advanced", 
            newRound: team.currentRound,
            status: team.status 
        });
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

/* ===============================
   LEADERBOARD CONTROL
================================= */

/* Get Leaderboard Status */
router.get("/leaderboard/status", async (req, res) => {
    try {
        const setting = await Settings.findOne({ key: "leaderboardEnabled" });
        
        res.json({
            enabled: setting ? setting.value : true,
            updatedAt: setting ? setting.updatedAt : null
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

/* Toggle Leaderboard ON/OFF */
router.post("/leaderboard/toggle", async (req, res) => {
    try {
        const { enabled } = req.body;
        
        const setting = await Settings.findOneAndUpdate(
            { key: "leaderboardEnabled" },
            { 
                value: enabled,
                updatedAt: new Date()
            },
            { upsert: true, returnDocument: "after" }
        );

        res.json({
            success: true,
            enabled: setting.value,
            message: `Leaderboard ${setting.value ? 'enabled' : 'disabled'}`
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
