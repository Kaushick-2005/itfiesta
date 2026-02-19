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

// If heartbeat gap exceeds this, treat it as app/browser leave.
const ESCAPE_INACTIVITY_THRESHOLD_MS = 12 * 1000;
const ESCAPE_TRANSITION_GRACE_MS = 90 * 1000;
const ESCAPE_LEVEL_DURATIONS = {
    1: 180,
    2: 240,
    3: 360,
    4: 300,
    5: 180
};

function getEscapeLevelDurationSeconds(level) {
    return ESCAPE_LEVEL_DURATIONS[level] || 300;
}

function ensureEscapeLevelTimerState(team) {
    const level = Number(team.currentRound || 1);
    const expectedDuration = getEscapeLevelDurationSeconds(level);
    const needsReset = (
        Number(team.escapeLevelNumber || 0) !== level ||
        !team.escapeLevelStartedAt ||
        Number(team.escapeLevelDurationSec || 0) !== expectedDuration
    );

    if (needsReset) {
        team.escapeLevelNumber = level;
        team.escapeLevelStartedAt = new Date();
        team.escapeLevelDurationSec = expectedDuration;
    }

    return {
        changed: needsReset,
        level,
        duration: expectedDuration
    };
}

function hasEscapeLevelTimedOut(team) {
    const startedAt = team.escapeLevelStartedAt ? new Date(team.escapeLevelStartedAt) : null;
    const durationSec = Number(team.escapeLevelDurationSec || 0);

    if (!startedAt || !durationSec) return false;
    return (Date.now() - startedAt.getTime()) >= durationSec * 1000;
}

async function advanceEscapeLevelOnTimeout(team) {
    const currentLevel = Number(team.currentRound || 1);
    const nextLevel = currentLevel + 1;

    team.currentRound = nextLevel;

    if (nextLevel > 5) {
        team.status = "completed";
        team.escapeLevelNumber = undefined;
        team.escapeLevelStartedAt = undefined;
        team.escapeLevelDurationSec = undefined;

        if (!team.examEndTime) {
            team.examEndTime = new Date();
        }
        if (team.examStartTime) {
            team.totalExamTime = new Date(team.examEndTime).getTime() - new Date(team.examStartTime).getTime();
        }
    } else {
        team.status = "active";
        team.escapeLevelNumber = nextLevel;
        team.escapeLevelStartedAt = new Date();
        team.escapeLevelDurationSec = getEscapeLevelDurationSeconds(nextLevel);
    }

    await team.save();
    return team;
}

async function applyEscapeTabSwitchPenalty(teamId, reason = "TAB_SWITCH") {
    const updated = await Team.findOneAndUpdate(
        { teamId },
        {
            $inc: { score: -10, penalty: 10, tabSwitchCount: 1 },
            $set: { antiCheatLastViolationAt: new Date() }
        },
        { returnDocument: "after" }
    );

    if (updated) {
        console.log(`[EscapeAntiCheat:${reason}] Team ${updated.teamId}, count=${updated.tabSwitchCount}, score=${updated.score}, penalty=${updated.penalty}`);
    }

    return updated;
}

// ==================== QUESTIONS ====================

/**
 * GET /api/escape/questions/:level
 * Get all questions for a level
 */
router.get("/questions/:level", async (req, res) => {
    try {
        const level = parseInt(req.params.level);
        
        let questions;
        
        // For Level 5, use raw MongoDB query to preserve options object structure
        if (level === 5) {
            const db = mongoose.connection.db;
            const questionsCol = db.collection('escapequestions');
            questions = await questionsCol.find({ level }).toArray();
        } else {
            questions = await EscapeQuestion.find({ level });
            
            // Fallback: direct MongoDB query
            if (!questions.length) {
                const db = mongoose.connection.db;
                const questionsCol = db.collection('escapequestions');
                const rawQuestions = await questionsCol.find({ level }).toArray();
                if (rawQuestions.length) {
                    questions = rawQuestions;
                }
            }
        }
        
        // Special handling for Level 5: Group by scenario_id and stage
        if (level === 5) {
            // Group documents by scenario_id
            const grouped = {};
            
            questions.forEach(doc => {
                const scenarioId = doc.scenario_id || doc.scenarioId;
                const stage = doc.stage || 1;
                
                if (!grouped[scenarioId]) {
                    grouped[scenarioId] = {
                        scenario_id: scenarioId,
                        title: doc.title || `Scenario ${scenarioId}`,
                        stages: []
                    };
                }
                
                // Add stage with options
                grouped[scenarioId].stages.push({
                    stage: stage,
                    text: doc.text || doc.description || '',
                    options: doc.options || []
                });
            });
            
            // Convert to array and sort stages within each scenario
            const scenarios = Object.values(grouped).map(scenario => {
                scenario.stages.sort((a, b) => a.stage - b.stage);
                return scenario;
            });
            
            console.log(`[Level 5] Grouped ${questions.length} documents into ${scenarios.length} scenarios`);
            return res.json(scenarios);
        }
        
        // For other levels: Shuffle questions for each request
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
        
        let team = await Team.findOne({ teamId: team_id });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }
        
        // Check if eliminated/disqualified
        if (team.status === "eliminated" || team.status === "disqualified") {
            return res.json({ status: "blocked", message: "Team eliminated" });
        }

        // If already completed all 5 levels, always send leaderboard redirect
        // (do this BEFORE batch checks so completed teams never get sent to waiting page)
        const preCheckLevel = team.currentRound || 1;
        if (team.status === "completed" || preCheckLevel > 5) {
            if (!team.examEndTime && team.examStartTime) {
                team.examEndTime = new Date();
                team.totalExamTime = new Date(team.examEndTime) - new Date(team.examStartTime);
                team.status = "completed";
                await team.save();
            }

            return res.json({
                status: "completed",
                message: "All levels completed!",
                redirect: "/escape/leaderboard.html"
            });
        }

        // 🔥 CHECK BATCH ASSIGNMENT BEFORE ALLOWING EXAM START (only for non-completed teams)
        if (team.batch === null || team.batch === undefined) {
            return res.status(403).json({ 
                error: "Batch not started yet. Please wait for admin to start your batch.",
                status: "waiting",
                message: "Your batch hasn't started yet. Please wait for admin announcement.",
                redirect: "/escape/leaderboard.html"
            });
        }
        
        // Record exam start time if not already recorded
        if (!team.examStartTime) {
            team.examStartTime = new Date();
            team.status = "active";
            team.antiCheatLastHeartbeatAt = new Date();
            await team.save();
        }
        
        // Get current level from team
        let currentLevel = team.currentRound || 1;
        
        // If completed all 5 levels
        if (currentLevel > 5) {
            // Record exam end time if not already recorded
            if (!team.examEndTime && team.examStartTime) {
                team.examEndTime = new Date();
                team.totalExamTime = team.examEndTime - team.examStartTime;
                team.status = "completed";
                await team.save();
            }
            
            return res.json({ 
                status: "completed", 
                message: "All levels completed!",
                redirect: "/escape/leaderboard.html"
            });
        }

        // Keep server-side level timer authoritative across reloads.
        const levelTimerState = ensureEscapeLevelTimerState(team);

        if (hasEscapeLevelTimedOut(team)) {
            team = await advanceEscapeLevelOnTimeout(team);
            currentLevel = Number(team.currentRound || 1);

            if (currentLevel > 5 || team.status === "completed") {
                return res.json({
                    status: "completed",
                    message: "All levels completed!",
                    redirect: "/escape/leaderboard.html"
                });
            }
        } else if (levelTimerState.changed) {
            await team.save();
        }

        let reconnectPenalty = null;
        const now = new Date();
        const lastHeartbeat = team.antiCheatLastHeartbeatAt
            ? new Date(team.antiCheatLastHeartbeatAt)
            : null;
        const lastViolation = team.antiCheatLastViolationAt
            ? new Date(team.antiCheatLastViolationAt)
            : null;
        const transitionGraceUntil = team.antiCheatTransitionGraceUntil
            ? new Date(team.antiCheatTransitionGraceUntil)
            : null;
        const withinTransitionGrace = !!(
            transitionGraceUntil &&
            transitionGraceUntil.getTime() > now.getTime()
        );

        if (team.status === "active" && lastHeartbeat) {
            const inactiveMs = Math.max(0, now.getTime() - lastHeartbeat.getTime());
            const alreadyPenalizedForLastLeave = !!(
                lastViolation &&
                lastViolation.getTime() > lastHeartbeat.getTime()
            );

            if (
                !withinTransitionGrace &&
                inactiveMs >= ESCAPE_INACTIVITY_THRESHOLD_MS &&
                !alreadyPenalizedForLastLeave
            ) {
                const penalizedTeam = await applyEscapeTabSwitchPenalty(
                    team.teamId,
                    "BROWSER_EXIT_OR_RECENT_APPS"
                );

                if (penalizedTeam) {
                    reconnectPenalty = {
                        applied: true,
                        inactiveSeconds: Math.floor(inactiveMs / 1000),
                        message: `APP/BROWSER EXIT DETECTED\n\nPenalty Applied: -10 marks\nTotal Tab/App Switches: ${penalizedTeam.tabSwitchCount}\nCurrent Score: ${penalizedTeam.score || 0}`
                    };
                    team = penalizedTeam;
                }
            }
        }

        team.antiCheatLastHeartbeatAt = now;
        if (!withinTransitionGrace) {
            team.antiCheatTransitionGraceUntil = undefined;
        }
        await team.save();
        
        res.json({
            status: "active",
            currentLevel: currentLevel,
            teamId: team.teamId,
            teamName: team.teamName,
            score: team.score || 0,
            penalty: team.penalty || 0,
            batch: team.batch,
            reconnectPenalty
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
        
        const nextLevel = currentLevel + 1;
        const isCompleted = nextLevel > 5;

        // Add score and advance to next level + initialize next-level timer state.
        const update = {
            $inc: { score: score, currentRound: 1 },
            $set: {
                status: isCompleted ? "completed" : "active"
            }
        };

        if (isCompleted) {
            update.$set.examEndTime = new Date();
            if (team.examStartTime) {
                update.$set.totalExamTime = new Date() - new Date(team.examStartTime);
            }
            update.$unset = {
                escapeLevelNumber: "",
                escapeLevelStartedAt: "",
                escapeLevelDurationSec: ""
            };
        } else {
            update.$set.escapeLevelNumber = nextLevel;
            update.$set.escapeLevelStartedAt = new Date();
            update.$set.escapeLevelDurationSec = getEscapeLevelDurationSeconds(nextLevel);
        }

        // Grace window prevents false anti-cheat penalty while user intentionally
        // transitions from submit modal to the next level page.
        update.$set.antiCheatLastHeartbeatAt = new Date();
        update.$set.antiCheatTransitionGraceUntil = new Date(Date.now() + ESCAPE_TRANSITION_GRACE_MS);

        await Team.updateOne({ teamId: team_id }, update);
        
        console.log(`Escape: Team ${team_id} completed Level ${level} with score ${score}. Advancing to Level ${nextLevel}`);
        
        // Determine redirect
        let redirect;
        if (isCompleted) {
            redirect = "/escape/leaderboard.html";
        } else {
            redirect = `/escape/levels/level${nextLevel}.html`;
        }
        
        res.json({
            success: true,
            levelScore: score,
            nextLevel: isCompleted ? 5 : nextLevel,
            completed: isCompleted,
            redirect: redirect
        });
        
    } catch (err) {
        console.error("Escape submit error:", err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/escape/timeout-advance
 * Advance team to next level when level time is already over on reload
 */
router.post("/timeout-advance", async (req, res) => {
    try {
        const { team_id, level } = req.body;
        const requestedLevel = Number(level);

        if (!team_id || !Number.isFinite(requestedLevel)) {
            return res.status(400).json({ error: "team_id and level are required" });
        }

        const team = await Team.findOne({ teamId: team_id });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const currentLevel = Number(team.currentRound || 1);

        if (currentLevel > 5) {
            return res.json({
                success: true,
                completed: true,
                nextLevel: 5,
                redirect: "/escape/leaderboard.html"
            });
        }

        // If already advanced, just redirect to the currently active level.
        if (currentLevel > requestedLevel) {
            return res.json({
                success: true,
                alreadyAdvanced: true,
                nextLevel: currentLevel,
                redirect: currentLevel > 5
                    ? "/escape/leaderboard.html"
                    : `/escape/levels/level${currentLevel}.html`
            });
        }

        // If requested level doesn't match current, keep user on server-truth level.
        if (currentLevel < requestedLevel) {
            return res.json({
                success: true,
                nextLevel: currentLevel,
                redirect: `/escape/levels/level${currentLevel}.html`
            });
        }

        const nextLevel = currentLevel + 1;
        const completed = nextLevel > 5;

        const update = {
            $inc: { currentRound: 1 },
            $set: { status: completed ? "completed" : "active" }
        };

        if (completed) {
            update.$set.examEndTime = new Date();
            if (team.examStartTime) {
                update.$set.totalExamTime = new Date(update.$set.examEndTime) - new Date(team.examStartTime);
            }
            update.$unset = {
                escapeLevelNumber: "",
                escapeLevelStartedAt: "",
                escapeLevelDurationSec: ""
            };
        } else {
            update.$set.escapeLevelNumber = nextLevel;
            update.$set.escapeLevelStartedAt = new Date();
            update.$set.escapeLevelDurationSec = getEscapeLevelDurationSeconds(nextLevel);
        }

        update.$set.antiCheatLastHeartbeatAt = new Date();
        update.$set.antiCheatTransitionGraceUntil = new Date(Date.now() + ESCAPE_TRANSITION_GRACE_MS);

        await Team.updateOne({ teamId: team_id }, update);

        return res.json({
            success: true,
            timeoutAdvanced: true,
            completed,
            nextLevel: completed ? 5 : nextLevel,
            redirect: completed
                ? "/escape/leaderboard.html"
                : `/escape/levels/level${nextLevel}.html`
        });
    } catch (err) {
        console.error("Escape timeout-advance error:", err);
        return res.status(500).json({ error: err.message });
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
        const { team_id, hiddenMs } = req.body;

        const teamState = await Team.findOne({ teamId: team_id })
            .select("teamId antiCheatLastViolationAt")
            .lean();

        if (!teamState) {
            return res.json({ error: "Team not found" });
        }

        const now = Date.now();
        // REMOVED: Grace period - all tab switches are penalized
        // Crime is crime - no exceptions for any tab switch detection

        // Balanced: Prevent spam while allowing quick consecutive legitimate detections
        const lastViolationAt = teamState.antiCheatLastViolationAt
            ? new Date(teamState.antiCheatLastViolationAt).getTime()
            : 0;
        const timeSinceLastViolation = now - lastViolationAt;
        if (timeSinceLastViolation < 1500) { // 1.5 seconds minimum
            return res.json({
                action: "ignored",
                reason: "rapid_consecutive_detection",
                timeSinceLastMs: timeSinceLastViolation
            });
        }

        const hiddenDuration = Number(hiddenMs || 0);
        if (Number.isFinite(hiddenDuration) && hiddenDuration > 0 && hiddenDuration < 300) {
            return res.json({
                action: "ignored",
                reason: "brief_hidden_state",
                hiddenMs: hiddenDuration
            });
        }

        // Additional validation: ignore suspiciously long periods (system sleep/hibernate)
        if (hiddenDuration > 600000) { // 10 minutes
            return res.json({
                action: "ignored", 
                reason: "very_long_hidden_state_likely_system_sleep",
                hiddenMs: hiddenDuration
            });
        }

        // ZERO TOLERANCE: All tab switches penalized regardless of platform
        // No special handling for mobile - crime is crime
        
        const team = await applyEscapeTabSwitchPenalty(team_id, "VISIBILITY_TAB_SWITCH");
        
        if (!team) {
            return res.json({ error: "Team not found" });
        }
        
        const totalScore = team.score || 0;
        console.log(`Escape tab/app switch: Team ${team.teamId}, count=${team.tabSwitchCount}, score=${team.score}`);
        
        res.json({
            action: "penalty",
            message: `TAB/APP SWITCH DETECTED\n\nPenalty Applied: -10 marks\nTotal Tab/App Switches: ${team.tabSwitchCount}\nCurrent Score: ${totalScore}`,
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

/**
 * POST /api/escape/heartbeat
 * Keeps anti-cheat heartbeat updated while level page is active.
 */
router.post("/heartbeat", async (req, res) => {
    try {
        const { team_id } = req.body;
        if (!team_id) {
            return res.status(400).json({ ok: false, error: "team_id required" });
        }

        const updated = await Team.findOneAndUpdate(
            { teamId: team_id },
            { $set: { antiCheatLastHeartbeatAt: new Date() } },
            { returnDocument: "after" }
        );

        if (!updated) {
            return res.status(404).json({ ok: false, error: "Team not found" });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error("Escape heartbeat error:", err);
        return res.status(500).json({ ok: false, error: "Heartbeat failed" });
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
        const teamId = String(req.query.team_id || "").trim();

        // Fallback behavior if team is not supplied.
        if (!teamId) {
            return res.json({
                level,
                duration: getEscapeLevelDurationSeconds(level),
                startTime: new Date().toISOString(),
                serverNow: Date.now()
            });
        }

        const team = await Team.findOne({ teamId });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        const currentLevel = Number(team.currentRound || 1);

        if (currentLevel > 5 || team.status === "completed") {
            return res.json({
                level: 5,
                completed: true,
                duration: 0,
                startTime: team.escapeLevelStartedAt ? new Date(team.escapeLevelStartedAt).toISOString() : new Date().toISOString(),
                redirect: "/escape/leaderboard.html",
                serverNow: Date.now()
            });
        }

        ensureEscapeLevelTimerState(team);

        if (hasEscapeLevelTimedOut(team)) {
            await advanceEscapeLevelOnTimeout(team);

            if (Number(team.currentRound || 1) > 5 || team.status === "completed") {
                return res.json({
                    level: 5,
                    completed: true,
                    duration: 0,
                    startTime: new Date().toISOString(),
                    redirect: "/escape/leaderboard.html",
                    serverNow: Date.now()
                });
            }
        } else {
            await team.save();
        }

        const serverLevel = Number(team.currentRound || 1);
        const serverDuration = getEscapeLevelDurationSeconds(serverLevel);
        const serverStart = team.escapeLevelStartedAt
            ? new Date(team.escapeLevelStartedAt).toISOString()
            : new Date().toISOString();

        return res.json({
            level: serverLevel,
            duration: serverDuration,
            startTime: serverStart,
            redirect: serverLevel !== level ? `/escape/levels/level${serverLevel}.html` : null,
            serverNow: Date.now()
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
            status: team.status,
            completed: team.status === "completed" || (team.currentRound || 1) > 5
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
