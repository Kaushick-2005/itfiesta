const express = require("express");
const router = express.Router();
const Team = require("../models/Team");


/* ===============================
   1️⃣ Get Teams (With Filters)
================================= */
router.get("/teams", async (req, res) => {
    try {

        const { eventType, batch, status } = req.query;

        let filter = {};

        if (eventType) filter.eventType = eventType;
        if (batch) filter.batch = Number(batch);
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
   3️⃣ Add Penalty
================================= */
router.patch("/add-penalty/:id", async (req, res) => {
    try {

        const { points } = req.body;

        await Team.findByIdAndUpdate(req.params.id, {
            $inc: {
                penalty: Number(points),
                score: -Math.abs(Number(points))
            }
        });

        res.json({ message: "Penalty added" });

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
   5️⃣ Start Batch
================================= */
router.patch("/start-batch", async (req, res) => {
    try {

        const { eventType, batch } = req.body;

        await Team.updateMany(
            { eventType, batch: Number(batch) },
            {
                status: "active",
                startTime: new Date()
            }
        );

        res.json({ message: "Batch started" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   6️⃣ End Batch
================================= */
router.patch("/end-batch", async (req, res) => {
    try {

        const { eventType, batch } = req.body;

        await Team.updateMany(
            { eventType, batch: Number(batch) },
            {
                status: "completed",
                endTime: new Date()
            }
        );

        res.json({ message: "Batch ended" });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


/* ===============================
   🏆 Leaderboard
================================= */
router.get("/leaderboard", async (req, res) => {
    try {

        const teams = await Team.find()
            .sort({ score: -1 });

        res.json(teams);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});


module.exports = router;
