const express = require("express");
const router = express.Router();
const Event = require("../models/Event");

// Get all events (admin view)
router.get("/", async (_req, res) => {
    try {
        const events = await Event.find().sort({ title: 1 });
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: "Unable to fetch events" });
    }
});

// Get only active events (public registration)
router.get("/active", async (_req, res) => {
    try {
        const events = await Event.find({ isActive: true })
            .sort({ title: 1 })
            .select("key title isActive");
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: "Unable to fetch active events" });
    }
});

// Toggle/Update event availability
router.put("/:key", async (req, res) => {
    try {
        const key = String(req.params.key || "").toLowerCase();
        const { isActive } = req.body;

        if (typeof isActive !== "boolean") {
            return res.status(400).json({ message: "isActive (boolean) is required" });
        }

        const updated = await Event.findOneAndUpdate(
            { key },
            { isActive },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Event not found" });
        }

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: "Unable to update event" });
    }
});

module.exports = router;
