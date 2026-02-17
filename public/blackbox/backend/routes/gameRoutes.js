const express = require("express");
const router = express.Router();

const gameController = require("../controllers/gameController");

//router.get("/clear-sessions", gameController.clearSessions);

router.post("/test", gameController.generateOutput);

router.post("/force-eliminate", gameController.forceEliminate);
// Insert sample data (run once)
//router.get("/insert-data", gameController.insertSampleData);

// Start round
router.post("/start", gameController.startGame);

// Submit answer
router.post("/submit", gameController.submitAnswer);

// Leaderboard
router.get("/leaderboard", gameController.leaderboard);

module.exports = router;
