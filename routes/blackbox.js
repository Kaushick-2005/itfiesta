const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Main Team model (from your registration system)
const Team = require("../models/Team");

// If a session stops sending heartbeat for this long,
// treat it as app/browser leave and apply tab-switch penalty on resume.
const SESSION_INACTIVITY_THRESHOLD_MS = 12 * 1000;
const BLACKBOX_ROUND_DURATIONS = {
    1: 8 * 60,
    2: 10 * 60,
    3: 6 * 60
};

// ==================== HELPER FUNCTIONS FOR FORMULAS ====================

function gcd(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function factorial(n) {
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function toSafeString(value) {
    if (value === null || value === undefined) return "";
    return String(value);
}

function isAnagram(a, b) {
    const left = toSafeString(a).replace(/\s+/g, "").toLowerCase();
    const right = toSafeString(b).replace(/\s+/g, "").toLowerCase();
    return left.split("").sort().join("") === right.split("").sort().join("");
}

function isSubsequence(s1, s2) {
    s1 = toSafeString(s1);
    s2 = toSafeString(s2);
    let j = 0;
    for (let i = 0; i < s1.length && j < s2.length; i++) {
        if (s1[i] === s2[j]) j++;
    }
    return j === s2.length;
}

function middleDigit(x) {
    const str = String(Math.abs(x));
    const len = str.length;
    if (len === 0) return 0;
    const midIndex = Math.floor(len / 2);
    return parseInt(str[midIndex]);
}

function sumDigits(x) {
    return String(Math.abs(x)).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
}

function reverseNumber(x) {
    return parseInt(String(Math.abs(x)).split('').reverse().join('')) * Math.sign(x);
}

function isPalindrome(x) {
    const str = String(Math.abs(x));
    return str === str.split('').reverse().join('');
}

function countVowels(str) {
    return (toSafeString(str).match(/[aeiouAEIOU]/g) || []).length;
}

function isPrime(n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6) {
        if (n % i === 0 || n % (i + 2) === 0) return false;
    }
    return true;
}

// Additional missing functions from database
function reverse(x) {
    return toSafeString(x).split('').reverse().join('');
}

function countDistinctCharacters(str) {
    return new Set(toSafeString(str).toLowerCase()).size;
}

function longestCommonPrefix(x, y) {
    x = toSafeString(x);
    y = toSafeString(y);
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return x.substring(0, i);
}

function mergeAlternately(x, y) {
    x = toSafeString(x);
    y = toSafeString(y);
    let result = '';
    const maxLen = Math.max(x.length, y.length);
    for (let i = 0; i < maxLen; i++) {
        if (i < x.length) result += x[i];
        if (i < y.length) result += y[i];
    }
    return result;
}

function removeDuplicates(str) {
    return [...new Set(toSafeString(str))].join('');
}

function longestCommonSubstring(x, y) {
    x = toSafeString(x);
    y = toSafeString(y);
    let longest = '';
    for (let i = 0; i < x.length; i++) {
        for (let j = i + 1; j <= x.length; j++) {
            const substr = x.substring(i, j);
            if (y.includes(substr) && substr.length > longest.length) {
                longest = substr;
            }
        }
    }
    return longest;
}

function countConsonants(str) {
    return toSafeString(str).toLowerCase().split('').filter(c => /[bcdfghjklmnpqrstvwxyz]/.test(c)).length;
}

function rotateLeft(str) {
    str = toSafeString(str);
    if (!str.length) return "";
    return str.substring(1) + str[0];
}

function rotateRightDigit(x, k) {
    const str = String(x);
    const len = str.length;
    k = k % len;
    return str.substring(len - k) + str.substring(0, len - k);
}

function digitProduct(x) {
    return String(Math.abs(x)).split('').reduce((prod, digit) => prod * parseInt(digit), 1);
}

function mod9Value(x) {
    while (x >= 10) {
        x = String(x).split('').reduce((sum, digit) => sum + parseInt(digit), 0);
    }
    return x;
}

function productMinusSum(x) {
    const digits = String(Math.abs(x)).split('').map(Number);
    const product = digits.reduce((a, b) => a * b, 1);
    const sum = digits.reduce((a, b) => a + b, 0);
    return product - sum;
}

function reverseAndDouble(x) {
    return reverseNumber(x) * 2;
}

function reverseIncrement(x) {
    return reverseNumber(x) + 1;
}

function countOnesBinary(x) {
    return x.toString(2).split('1').length - 1;
}

function maxDigit(x) {
    const digits = String(Math.abs(Number(x) || 0)).split('').map(Number);
    return digits.length ? Math.max(...digits) : 0;
}

function minDigit(x) {
    const digits = String(Math.abs(Number(x) || 0)).split('').map(Number);
    return digits.length ? Math.min(...digits) : 0;
}

function differenceMaxMinDigit(x) {
    return maxDigit(x) - minDigit(x);
}

function distanceToNearest10(x) {
    const n = Number(x);
    if (!Number.isFinite(n)) return NaN;

    // Distance to nearest multiple of 10
    // Example: 5 -> 5, 14 -> 4, 19 -> 1, -14 -> 4
    const remainder = Math.abs(n % 10);
    return Math.min(remainder, 10 - remainder);
}

function evaluateFormula(formula, context = {}) {
    const x = context.x;
    const y = context.y !== undefined ? context.y : context.k;
    const k = context.k !== undefined ? context.k : context.y;
    const age = context.age;
    const score = context.score;
    const role = context.role;

    const scope = {
        // variables expected in questions
        x, y, k, age, score, role,

        // standard object allowed in formulas
        Math,

        // helper functions supported in DB formulas
        gcd,
        factorial,
        isAnagram,
        isSubsequence,
        middleDigit,
        sumDigits,
        reverseNumber,
        isPalindrome,
        countVowels,
        isPrime,
        reverse,
        countDistinctCharacters,
        longestCommonPrefix,
        mergeAlternately,
        removeDuplicates,
        longestCommonSubstring,
        countConsonants,
        rotateLeft,
        rotateRightDigit,
        digitProduct,
        mod9Value,
        productMinusSum,
        reverseAndDouble,
        reverseIncrement,
        countOnesBinary,
        maxDigit,
        minDigit,
        differenceMaxMinDigit,
        distanceToNearest10
    };

    const argNames = Object.keys(scope);
    const argValues = Object.values(scope);
    const evaluator = new Function(...argNames, `"use strict"; return (${formula});`);
    return evaluator(...argValues);
}

function getBlackboxRoundDuration(round) {
    return BLACKBOX_ROUND_DURATIONS[round] || 300;
}

// ==================== BLACKBOX MODELS ====================

// BlackBox models (we'll create inline schemas for simplicity)
const questionSchema = new mongoose.Schema({
    round: Number,
    formula: String,
    variables: Number,
    duration: Number,
    keywords: [String],
    maxScore: Number,
    evaluation: {
        requiredKeywords: [String],
        logicalOperators: [String],
        comparisons: [String],
        weight: {
            keywords: Number,
            logic: Number,
            comparisons: Number
        }
    }
});

const sessionSchema = new mongoose.Schema({
    team_id: String,
    question_id: { type: mongoose.Schema.Types.ObjectId, ref: "BlackBoxQuestion" },
    round: Number,
    start_time: Date,
    end_time: Date,
    status: String,
    score: Number,
    lastHeartbeatAt: {
        type: Date,
        default: Date.now
    },
    lastViolationAt: Date
});

const BlackBoxQuestion = mongoose.models.BlackBoxQuestion || mongoose.model("BlackBoxQuestion", questionSchema);
const BlackBoxSession = mongoose.models.BlackBoxSession || mongoose.model("BlackBoxSession", sessionSchema);

// Also try to access existing Question collection if it exists
let ExistingQuestion = null;
try {
    ExistingQuestion = mongoose.models.Question || mongoose.model("Question", questionSchema);
} catch (e) {
    // ignore
}

// ==================== HELPER FUNCTIONS ====================

function gcd(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function factorial(n) {
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
}

function isAnagram(a, b) {
    const left = toSafeString(a).replace(/\s+/g, "").toLowerCase();
    const right = toSafeString(b).replace(/\s+/g, "").toLowerCase();
    return left.split("").sort().join("") === right.split("").sort().join("");
}

function isSubsequence(s1, s2) {
    s1 = toSafeString(s1);
    s2 = toSafeString(s2);
    let j = 0;
    for (let i = 0; i < s1.length && j < s2.length; i++) {
        if (s1[i] === s2[j]) j++;
    }
    return j === s2.length;
}

async function applyTabSwitchPenaltyForTeam(teamId, reason = "TAB_SWITCH") {
    const team = await Team.findOneAndUpdate(
        { teamId },
        { $inc: { score: -10, penalty: 10, tabSwitchCount: 1 } },
        { returnDocument: "after" }
    );

    if (team) {
        console.log(`[AntiCheat:${reason}] Team ${team.teamId}: count=${team.tabSwitchCount}, score=${team.score}, penalty=${team.penalty}`);
    }

    return team;
}

// ==================== ROUTES ====================

/**
 * POST /api/blackbox/start
 * Start current round for a team - no batch restrictions
 */
router.post("/start", async (req, res) => {
    try {
        const { team_id } = req.body;

        // Verify team exists in main system
        const team = await Team.findOne({ teamId: team_id });
        if (!team) {
            return res.status(404).json({ error: "Team not found" });
        }

        // Set batch to waiting if null (for existing teams without batch)
        if (team.batch === null) {
            team.batch = "waiting";
            await team.save();
        }

        // Check if team is already eliminated or completed
        if (team.status === "eliminated" || team.status === "disqualified") {
            return res.json({ status: "blocked", message: "Team already eliminated" });
        }

        // Record exam start time if not already recorded
        if (!team.examStartTime) {
            team.examStartTime = new Date();
            team.status = "active";
            await team.save();
        }

        // Get current round from team (backend-controlled)
        const round = team.currentRound || 1;

        // If currentRound > 3, team has completed all rounds
        if (round > 3) {
            // Record exam end time if not already recorded
            if (!team.examEndTime && team.examStartTime) {
                team.examEndTime = new Date();
                team.totalExamTime = team.examEndTime - team.examStartTime;
                team.status = "completed";
                await team.save();
            }
            
            return res.json({ 
                status: "completed", 
                message: "All rounds completed!",
                redirect: "/blackbox/leaderboard.html"
            });
        }

        console.log("=== START DEBUG ===");
        console.log("Team:", team.teamId, "Current Round:", round, "Batch:", team.batch);

        // Check if active session exists (refresh case)
        const existingSession = await BlackBoxSession.findOne({
            team_id: team.teamId,
            round,
            status: "active"
        });

        if (existingSession) {
            const now = new Date();
            const lastHeartbeat = existingSession.lastHeartbeatAt
                ? new Date(existingSession.lastHeartbeatAt)
                : (existingSession.start_time ? new Date(existingSession.start_time) : now);
            const lastViolation = existingSession.lastViolationAt
                ? new Date(existingSession.lastViolationAt)
                : null;

            const inactiveMs = Math.max(0, now.getTime() - lastHeartbeat.getTime());
            const wasAlreadyPenalizedForLastLeave = !!(
                lastViolation &&
                lastViolation.getTime() > lastHeartbeat.getTime()
            );

            let reconnectPenalty = null;

            // Handles app clear / full browser close / force-kill cases
            // where visibilitychange may not reach backend.
            if (inactiveMs >= SESSION_INACTIVITY_THRESHOLD_MS && !wasAlreadyPenalizedForLastLeave) {
                const penalizedTeam = await applyTabSwitchPenaltyForTeam(
                    existingSession.team_id,
                    "BROWSER_EXIT_OR_RECENT_APPS"
                );

                if (penalizedTeam) {
                    reconnectPenalty = {
                        applied: true,
                        inactiveSeconds: Math.floor(inactiveMs / 1000),
                        message: `APP/BROWSER EXIT DETECTED\n\nPenalty Applied: -10 marks\nTotal Tab/App Switches: ${penalizedTeam.tabSwitchCount}\nCurrent Score: ${penalizedTeam.score || 0}`
                    };
                }

                existingSession.lastViolationAt = now;
            }

            existingSession.lastHeartbeatAt = now;
            await existingSession.save();

            const question = await BlackBoxQuestion.findById(existingSession.question_id);
            return res.json({
                session_id: existingSession._id,
                round: round,
                variables: question?.variables || 1,
                end_time: existingSession.end_time,
                batch: team.batch,
                reconnectPenalty
            });
        }

        // Get random question for this round
        let questions = await BlackBoxQuestion.find({ round });
        
        console.log("BlackBoxQuestions found:", questions.length);
        
        // Fallback: try direct MongoDB query
        if (!questions.length) {
            const db = mongoose.connection.db;
            const questionsCol = db.collection('blackboxquestions');
            const rawQuestions = await questionsCol.find({ round }).toArray();
            console.log("Raw questions from collection:", rawQuestions.length);
            if (rawQuestions.length) {
                questions = rawQuestions;
            }
        }
        
        if (!questions.length) {
            return res.json({ message: "No questions found for this round" });
        }

        // Random selection with logging
        const randomIndex = Math.floor(Math.random() * questions.length);
        const question = questions[randomIndex];
        
        console.log(`Selected question ${randomIndex + 1} of ${questions.length}: ${question.formula}`);

        const start = new Date();
        const durationSeconds = getBlackboxRoundDuration(round);
        const end = new Date(start.getTime() + durationSeconds * 1000);

        const session = await BlackBoxSession.create({
            team_id: team.teamId,
            question_id: question._id,
            round,
            start_time: start,
            end_time: end,
            status: "active",
            lastHeartbeatAt: start
        });

        res.json({
            session_id: session._id,
            round: round,
            variables: question.variables || 1,
            end_time: end,
            batch: team.batch
        });

    } catch (error) {
        console.error("BlackBox START ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/blackbox/heartbeat
 * Keeps active exam session alive while page is visible.
 */
router.post("/heartbeat", async (req, res) => {
    try {
        const { session_id } = req.body;
        if (!session_id) {
            return res.status(400).json({ ok: false, error: "session_id required" });
        }

        const updated = await BlackBoxSession.findByIdAndUpdate(
            session_id,
            { $set: { lastHeartbeatAt: new Date() } },
            { returnDocument: "after" }
        );

        if (!updated) {
            return res.status(404).json({ ok: false, error: "Session not found" });
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error("BlackBox HEARTBEAT ERROR:", err);
        return res.status(500).json({ ok: false, error: "Heartbeat failed" });
    }
});

/**
 * POST /api/blackbox/test
 * Generate output for given input
 */
router.post("/test", async (req, res) => {
    try {
        const { session_id, input } = req.body;

        console.log("=== /api/blackbox/test DEBUG ===");
        console.log("Session ID:", session_id);
        console.log("Input:", input);

        const session = await BlackBoxSession.findById(session_id).populate("question_id");
        if (!session) {
            console.log("ERROR: Session not found");
            return res.json({ output: "Session not found" });
        }

        const question = session.question_id;
        
        console.log("Question found:", question ? "YES" : "NO");
        console.log("Question round:", question?.round);
        console.log("Question formula:", question?.formula);
        console.log("Question variables:", question?.variables);

        if (!question || !question.formula) {
            console.log("ERROR: No question or formula");
            return res.json({ output: "Error - No formula" });
        }

        let output;

        // ROUND 1 → Numbers
        if (question.round === 1) {
            const parts = String(input).trim().split(/\s+/);
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            console.log("x =", x, "y =", y);
            output = evaluateFormula(question.formula, { x, y, k: y });
            console.log("Output:", output);
        }
        // ROUND 2 → Strings
        else if (question.round === 2) {
            const parts = String(input).trim().split(/\s+/);
            const x = parts[0];
            const y = parts[1];
            console.log("x =", x, "y =", y);
            output = evaluateFormula(question.formula, { x, y, k: y });
            console.log("Output:", output);
        }
        // ROUND 3 → JSON input
        else if (question.round === 3) {
            const obj = JSON.parse(input);
            const age = Number(obj.age);
            const score = Number(obj.score);
            const role = obj.role;
            console.log("age =", age, "score =", score, "role =", role);
            output = evaluateFormula(question.formula, { age, score, role, x: age, y: score, k: score });
            console.log("Output:", output);
        }

        res.json({ output });

    } catch (err) {
        console.error("BlackBox TEST ERROR:", err);
        res.json({ output: "Error" });
    }
});

/**
 * POST /api/blackbox/submit
 * Submit answer and update team score
 */
router.post("/submit", async (req, res) => {
    try {
        const { session_id, answer } = req.body;

        const session = await BlackBoxSession.findById(session_id).populate("question_id");
        if (!session) return res.json({ result: "error" });

        // Check time
        if (new Date() > session.end_time) {
            // Mark round completed (no penalty for time over)
            session.status = "completed";
            session.score = 0;
            await session.save();

            // Keep team progress in sync even on timeout.
            const currentRound = session.round;
            const nextRound = currentRound + 1;
            const team = await Team.findOne({ teamId: session.team_id });
            if (team) {
                team.currentRound = Math.max(Number(team.currentRound || 1), nextRound);

                if (nextRound > 3) {
                    team.status = "completed";
                    if (!team.examEndTime) {
                        team.examEndTime = new Date();
                    }
                    if (team.examStartTime) {
                        team.totalExamTime = new Date(team.examEndTime).getTime() - new Date(team.examStartTime).getTime();
                    }
                }

                await team.save();
            }

            return res.json({ 
                result: "time_over", 
                message: "Time expired!",
                moveTo: session.round === 1
                    ? "/blackbox/round2.html"
                    : session.round === 2
                    ? "/blackbox/round3.html"
                    : "/blackbox/leaderboard.html"
            });
        }

        const question = session.question_id;
        const explanation = answer.toLowerCase();
        let roundScore = 0;
        let isCorrect = false;

        // ==================== ROUND 1 → Exact Logic Match ====================
        if (question.round === 1) {
            let allCorrect = true;

            for (let i = 0; i < 5; i++) {
                const x = Math.floor(Math.random() * 20) + 1;
                const y = Math.floor(Math.random() * 20) + 1;

                let correctOutput;
                try {
                    correctOutput = evaluateFormula(question.formula, { x, y, k: y });
                } catch (formulaEvalErr) {
                    console.error("BlackBox formula evaluation error:", formulaEvalErr.message);
                    allCorrect = false;
                    break;
                }
                let userOutput;
                try {
                    userOutput = evaluateFormula(answer, { x, y, k: y });
                } catch (userEvalErr) {
                    allCorrect = false;
                    break;
                }

                if (String(correctOutput) !== String(userOutput)) {
                    allCorrect = false;
                    break;
                }
            }

            if (allCorrect) {
                const now = new Date();
                const timeUsedSeconds = Math.floor((now - session.start_time) / 1000);
                const totalDuration = getBlackboxRoundDuration(question.round);

                // Score based on time (50-100)
                roundScore = 100 - Math.floor((timeUsedSeconds / totalDuration) * 50);
                if (roundScore < 50) roundScore = 50;

                isCorrect = true;
            }
        }

        // ==================== ROUND 2 → Keyword Scoring ====================
        else if (question.round === 2) {
            let matchCount = 0;

            question.keywords.forEach(word => {
                if (explanation.includes(word.toLowerCase())) {
                    matchCount++;
                }
            });

            const accuracy = matchCount / question.keywords.length;
            roundScore = Math.floor(accuracy * question.maxScore);
            isCorrect = roundScore > 0;
        }

        // ==================== ROUND 3 → Structured Scoring ====================
        else if (question.round === 3) {
            const evalRules = question.evaluation;
            let totalScore = 0;

            // Keywords (30%)
            let keywordMatches = 0;
            evalRules.requiredKeywords.forEach(k => {
                if (explanation.includes(k)) keywordMatches++;
            });
            totalScore += (keywordMatches / evalRules.requiredKeywords.length) * evalRules.weight.keywords;

            // Logical Operators (30%)
            let logicMatches = 0;
            evalRules.logicalOperators.forEach(op => {
                if (explanation.includes(op)) logicMatches++;
            });
            totalScore += (logicMatches / evalRules.logicalOperators.length) * evalRules.weight.logic;

            // Comparisons (40%)
            let comparisonMatches = 0;
            evalRules.comparisons.forEach(c => {
                if (explanation.includes(c)) comparisonMatches++;
            });
            totalScore += (comparisonMatches / evalRules.comparisons.length) * evalRules.weight.comparisons;

            roundScore = Math.floor(totalScore);
            isCorrect = roundScore > 0;
        }

        // Update team score with old BlackBox marking system
        const currentRound = session.round;
        const nextRound = currentRound + 1;
        const awardedScore = isCorrect ? roundScore : (Math.floor(roundScore * 0.3) || 10);
        
        // Award marks and advance round
        const updatedTeam = await Team.findOneAndUpdate(
            { teamId: session.team_id },
            { $inc: { score: awardedScore, currentRound: 1 }, $set: { status: "active" } },
            { returnDocument: "after" }
        );

        // If final round is done, mark event as completed immediately
        // so admin panel + leaderboard status updates without requiring another /start call.
        if (updatedTeam && nextRound > 3) {
            const completeUpdate = {
                status: "completed",
                examEndTime: new Date()
            };
            if (updatedTeam.examStartTime) {
                completeUpdate.totalExamTime = new Date(completeUpdate.examEndTime).getTime() - new Date(updatedTeam.examStartTime).getTime();
            }
            await Team.updateOne({ teamId: session.team_id }, { $set: completeUpdate });
        }

        // Mark round completed
        session.status = "completed";
        session.score = isCorrect ? roundScore : 0;
        await session.save();

        console.log(`Team ${session.team_id} completed Round ${currentRound}, advancing to Round ${nextRound}`);

        // Return result with next round redirect (based on current round number)
        let moveTo;
        if (currentRound === 1) {
            moveTo = "/blackbox/round2.html";
        } else if (currentRound === 2) {
            moveTo = "/blackbox/round3.html";
        } else {
            moveTo = "/blackbox/leaderboard.html";
        }

        return res.json({
            result: isCorrect ? "correct" : "wrong",
            score: awardedScore,
            nextRound: nextRound,
            moveTo: moveTo,
            timeUsed: session.start_time ? Math.floor((new Date() - session.start_time) / 1000) : 0
        });

    } catch (err) {
        console.error("BlackBox SUBMIT ERROR:", err);
        res.json({ result: "error", message: "Invalid/failed submission" });
    }
});

// force-eliminate route removed - no automatic elimination

/**
 * POST /api/blackbox/tab-switch
 * Handle tab switch - deducts from score AND tracks penalty
 * Each switch → -10 score, +10 penalty tracked
 */
router.post("/tab-switch", async (req, res) => {
    try {
        const { session_id } = req.body;

        const session = await BlackBoxSession.findById(session_id);
        if (!session) {
            return res.json({ error: "Session not found" });
        }

        const team = await applyTabSwitchPenaltyForTeam(session.team_id, "VISIBILITY_TAB_SWITCH");

        if (!team) {
            return res.json({ error: "Team not found" });
        }

        session.lastViolationAt = new Date();
        await session.save();

        const totalScore = team.score || 0;
        console.log(`Tab/App switch for team ${team.teamId}: count=${team.tabSwitchCount}, score=${team.score}, penalty=${team.penalty}`);

        res.json({
            action: "penalty",
            message: `TAB/APP SWITCH DETECTED\n\nPenalty Applied: -10 marks\nTotal Tab/App Switches: ${team.tabSwitchCount}\nCurrent Score: ${totalScore}`,
            scoreDeducted: 10,
            penalty: team.penalty,
            currentScore: team.score,
            tabSwitchCount: team.tabSwitchCount
        });

    } catch (err) {
        console.error("Tab switch error:", err);
        res.json({ error: "Failed" });
    }
});

/**
 * GET /api/blackbox/team/:teamId
 * Get team info for blackbox teams
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
            eventType: team.eventType,
            currentRound: team.currentRound || 1,
            score: team.score || 0,
            penalty: team.penalty || 0,
            tabSwitchCount: team.tabSwitchCount || 0,
            status: team.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/blackbox/leaderboard
 * Get leaderboard from main Team model - sorted by Final Score
 */
router.get("/leaderboard", async (req, res) => {
    try {
        // Get teams that participated in blackbox
        const leaderboard = await Team.find({
            eventType: { $regex: /blackbox/i }
        })
        .select("teamId teamName score penalty status");

        // Calculate finalScore and sort by it
        const formatted = leaderboard.map(team => ({
            _id: team.teamName || team.teamId,
            score: team.score || 0,
            penalty: team.penalty || 0,
            totalScore: Math.max(0, (team.score || 0) - (team.penalty || 0))
        }));

        formatted.sort((a, b) => b.totalScore - a.totalScore);

        res.json(formatted);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
