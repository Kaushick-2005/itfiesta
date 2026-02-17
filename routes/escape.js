/**
 * Escape Room Routes
 * Integrated with main IT Fiesta system
 * 
 * Scoring:
 * - Correct answer: +marks (from question, usually 10)
 * - Tab switch: -10 (penalty tracked)
 * - 5 levels total
 */

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Team = require("../models/Team");
const EscapeQuestion = require("../models/EscapeQuestion");

// ==================== QUESTIONS ====================

/**
 * GET /api/escape/questions/:level
 * Get all questions for a level
 */
router.get("/questions/:level", async (req, res) => {
    try {
        const level = parseInt(req.params.level);
        
        let questions = await EscapeQuestion.find({ level });
        
        // Fallback: direct MongoDB query
        if (!questions.length) {
            const db = mongoose.connection.db;
            const questionsCol = db.collection('escapequestions');
            const rawQuestions = await questionsCol.find({ level }).toArray();
            if (rawQuestions.length) {
                questions = rawQuestions;
            }
        }
        
        // Shuffle questions for each request
        const shuffled = questions.sort(() => Math.random() - 0.5);
        
        res.json(shuffled);
        
    } catch (err) {
        console.error("Escape questions error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== TEAM START ====================

/**
 * POST /api/escape/start
 * Start escape room for a team
 */
router.post("/start", async (req, res) => {
    try {
        const { team_id } = req.body;
        
        const team = await Team.findOne({ teamId: team_id });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }
        
        // Check if eliminated/disqualified
        if (team.status === "eliminated" || team.status === "disqualified") {
            return res.json({ status: "blocked", message: "Team eliminated" });
        }
        
        // Get current level from team
        const currentLevel = team.currentRound || 1;
        
        // If completed all 5 levels
        if (currentLevel > 5) {
            return res.json({ 
                status: "completed", 
                message: "All levels completed!",
                redirect: "/escape/result/winner.html"
            });
        }
        
        res.json({
            status: "active",
            currentLevel: currentLevel,
            teamId: team.teamId,
            teamName: team.teamName,
            score: team.score || 0,
            penalty: team.penalty || 0
        });
        
    } catch (err) {
        console.error("Escape start error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== SUBMIT LEVEL ====================

/**
 * POST /api/escape/submit
 * Submit answers for a level
 */
router.post("/submit", async (req, res) => {
    try {
        const { team_id, level, score } = req.body;
        
        const team = await Team.findOne({ teamId: team_id });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }
        
        const currentLevel = team.currentRound || 1;
        
        // Verify submitting correct level
        if (level !== currentLevel) {
            return res.json({ 
                error: "Level mismatch", 
                expectedLevel: currentLevel 
            });
        }
        
        // Add score and advance to next level
        await Team.updateOne(
            { teamId: team_id },
            { 
                $inc: { score: score, currentRound: 1 }
            }
        );
        
        const nextLevel = currentLevel + 1;
        
        console.log(`Escape: Team ${team_id} completed Level ${level} with score ${score}. Advancing to Level ${nextLevel}`);
        
        // Determine redirect
        let redirect;
        if (nextLevel > 5) {
            redirect = "/escape/result/winner.html";
        } else {
            redirect = `/escape/levels/level${nextLevel}.html`;
        }
        
        res.json({
            success: true,
            levelScore: score,
            nextLevel: nextLevel,
            redirect: redirect
        });
        
    } catch (err) {
        console.error("Escape submit error:", err);
        res.status(500).json({ error: err.message });
    }
});

// ==================== TAB SWITCH ====================

/**
 * POST /api/escape/tab-switch
 * Handle tab switch penalty
 * Each switch → -10 score, +10 penalty tracked
 */
router.post("/tab-switch", async (req, res) => {
    try {
        const { team_id } = req.body;
        
        const team = await Team.findOneAndUpdate(
            { teamId: team_id },
            { $inc: { score: -10, penalty: 10, tabSwitchCount: 1 } },
            { new: true }
        );
        
        if (!team) {
            return res.json({ error: "Team not found" });
        }
        
        console.log(`Escape tab switch: Team ${team.teamId}, count=${team.tabSwitchCount}, score=${team.score}`);
        
        res.json({
            action: "penalty",
            message: `⚠ Tab switch detected!\n-10 marks deducted.\nTotal tab switches: ${team.tabSwitchCount}`,
            scoreDeducted: 10,
            penalty: team.penalty,
            currentScore: team.score,
            tabSwitchCount: team.tabSwitchCount
        });
        
    } catch (err) {
        console.error("Escape tab-switch error:", err);
        res.json({ error: "Failed" });
    }
});

// ==================== GET LEVEL START INFO ====================

/**
 * GET /api/escape/level/:level/start
 * Get level start info (duration, etc.)
 */
router.get("/level/:level/start", async (req, res) => {
    try {
        const level = parseInt(req.params.level);
        
        // Default durations per level (in seconds)
        const durations = {
            1: 180,  // 3 minutes
            2: 300,  // 5 minutes
            3: 300,  // 5 minutes
            4: 420,  // 7 minutes
            5: 600   // 10 minutes
        };
        
        res.json({
            level: level,
            duration: durations[level] || 300,
            startTime: new Date().toISOString()
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LEADERBOARD ====================

/**
 * GET /api/escape/leaderboard
 * Get escape room leaderboard
 */
router.get("/leaderboard", async (req, res) => {
    try {
        const teams = await Team.find({
            eventType: { $regex: /escape/i }
        })
        .select("teamId teamName score penalty tabSwitchCount currentRound status")
        .sort({ score: -1 });
        
        res.json(teams);
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== TEAM INFO ====================

/**
 * GET /api/escape/team/:teamId
 * Get team info
 */
router.get("/team/:teamId", async (req, res) => {
    try {
        const team = await Team.findOne({ teamId: req.params.teamId });
        
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }
        
        res.json({
            teamId: team.teamId,
            teamName: team.teamName,
            currentLevel: team.currentRound || 1,
            score: team.score || 0,
            penalty: team.penalty || 0,
            tabSwitchCount: team.tabSwitchCount || 0,
            status: team.status
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== LEVEL-SPECIFIC SUBMIT (for level 5) ====================

/**
 * POST /api/levels/:level/submit
 * Handle level-specific submissions (used by level 5)
 */
router.post("/levels/:level/submit", async (req, res) => {
    try {
        const level = parseInt(req.params.level);
        const { teamId, answer } = req.body;
        
        const team = await Team.findOne({ teamId: teamId });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }
        
        const currentLevel = team.currentRound || 1;
        
        // Verify submitting correct level
        if (level !== currentLevel) {
            return res.json({ 
                error: "Level mismatch", 
                expectedLevel: currentLevel 
            });
        }
        
        // For level 5, accept 'PASSED' as correct answer
        let isCorrect = false;
        let score = 0;
        
        if (level === 5 && answer === 'PASSED') {
            isCorrect = true;
            score = 50; // Level 5 completion bonus
        }
        
        if (isCorrect) {
            // Add score and advance
            await Team.updateOne(
                { teamId: teamId },
                { 
                    $inc: { score: score, currentRound: 1 }
                }
            );
            
            console.log(`Escape: Team ${teamId} completed Level ${level} with answer ${answer}. Score: ${score}`);
            
            res.json({
                result: 'correct',
                levelScore: score,
                nextLevel: level + 1
            });
        } else {
            res.json({
                result: 'incorrect',
                message: 'Answer not accepted'
            });
        }
        
    } catch (err) {
        console.error("Level submit error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
