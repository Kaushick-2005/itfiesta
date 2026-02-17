const express = require("express");
const router = express.Router();
const Team = require("../models/Team");
const Event = require("../models/Event");
const BatchControl = require("../models/BatchControl");

// 🔹 Generate Unique Team ID (No duplicates)
async function generateTeamId(eventType) {
    let teamId;
    let exists = true;

    while (exists) {
        const random = Math.floor(1000 + Math.random() * 9000);
        teamId = `${eventType.toUpperCase()}-${random}`;
        exists = await Team.findOne({ teamId });
    }

    return teamId;
}
// 🔹 Registration Page
router.get("/register", (req, res) => {
    res.send(`
        <h2>Register Team</h2>
        <form method="POST" action="/register">
            Team Name: <input name="teamName" required /><br/>
            Team Leader Name: <input name="leaderName" required /><br/>
            Leader Mobile: <input name="leaderMobile" required /><br/>
            Member 2 (Optional): <input name="member2" /><br/>
            Member 3 (Optional): <input name="member3" /><br/>
            Event Type:
            <select name="eventType" required>
                <option value="blackbox">Black Box</option>
                <option value="escape">Escape Room</option>
            </select><br/><br/>
            <button type="submit">Register</button>
        </form>
    `);
});
// 🔹 Handle Registration
router.post("/register", async (req, res) => {
    try {
        const { teamName, leaderName, leaderMobile, member2, member3 } = req.body;
        const requestedEvent = String(req.body.eventType || "").toLowerCase();
        
        if (!requestedEvent) {
            return res.status(400).json({ success: false, message: "Event selection is required." });
        }

        const eventRecord = await Event.findOne({ key: requestedEvent });
        if (!eventRecord || !eventRecord.isActive) {
            return res.status(400).json({ success: false, message: "Registrations are currently closed for the selected event." });
        }

        // Set all new registrations to WAITING batch
        const teamId = await generateTeamId(requestedEvent);

        const newTeam = new Team({
            teamId,
            teamName,
            leaderName,
            leaderMobile,
            member2,
            member3,
            eventType: requestedEvent,
            batch: "waiting",  // Always set to waiting on registration
            score: 0,
            penalty: 0,
            tabSwitchCount: 0,
            status: "not_started"
        });

        await newTeam.save();

        res.json({ 
            success: true, 
            teamId,
            batch: "waiting",
            message: "Registration successful! You can start playing immediately."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Unable to complete registration." });
    }
});


// 🔹 Login Page
router.get("/login", (req, res) => {
    res.send(`
        <h2>Team Login</h2>
        <form method="POST" action="/login">
            Team ID: <input name="teamId" required /><br/>
            <button type="submit">Login</button>
        </form>
    `);
});
// 🔹 Handle Login
router.post("/login", async (req, res) => {
    try {
        const { teamId } = req.body;

        const team = await Team.findOne({ teamId });

        if (!team) {
            return res.json({ success: false });
        }

        req.session.teamId = team.teamId;

        res.json({
            success: true,
            teamName: team.teamName,
            eventType: team.eventType
        });

    } catch (error) {
        console.error(error);
        res.json({ success: false });
    }
});
module.exports = router;
