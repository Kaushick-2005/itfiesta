const express = require("express");
const router = express.Router();
const Team = require("../models/Team");


/* ===============================
   1️⃣ Get Teams (With Filters)
================================= */
router.get("/teams", async (req, res) => {
    try {

        const { eventType, status } = req.query;

        let filter = {};

        if (eventType) filter.eventType = eventType;
        if (status) filter.status = status;

        const teams = await Team.find(filter).sort({ score: -1 });

        res.json(teams);

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
router.get("/leaderboard", async (req, res) => {
    try {

        const teams = await Team.find().sort({ score: -1 });

        res.json(teams);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;

/* ===============================
   🎮 Advance Team to Next Round/Level
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

module.exports = router;
