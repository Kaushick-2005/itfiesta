const Question = require("../models/Question");
const GameSession = require("../models/GameSession");
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
  return a.split("").sort().join("") === b.split("").sort().join("");
}

function isSubsequence(s1, s2) {
  let j = 0;
  for (let i = 0; i < s1.length && j < s2.length; i++) {
    if (s1[i] === s2[j]) j++;
  }
  return j === s2.length;
}
exports.forceEliminate = async (req, res) => {
  try {
    const { session_id } = req.body;

    await GameSession.findByIdAndUpdate(session_id, {
      status: "eliminated"
    });

    res.json({ message: "Eliminated" });

  } catch (err) {
    res.json({ error: "Failed" });
  }
};

// 🔥 TEMP: CLEAR ALL SESSIONS
exports.clearSessions = async (req, res) => {
  try {
    await GameSession.deleteMany({});
    res.json({ message: "All sessions deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.generateOutput = async (req, res) => {
  try {

    const { session_id, input } = req.body;

    const session = await GameSession
      .findById(session_id)
      .populate("question_id");

    if (!session) return res.json({ result: "error" });

    const question = session.question_id;
    let output;

    // ROUND 1 → Numbers
    if (question.round === 1) {
      const parts = input.split(" ");
      const x = Number(parts[0]);
      const y = Number(parts[1]);
      output = eval(question.formula);
    }

    // ROUND 2 → Strings
    else if (question.round === 2) {
      const parts = input.split(" ");
      const x = parts[0];
      const y = parts[1];
      output = eval(question.formula);
    }

    // ROUND 3 → JSON input
    else if (question.round === 3) {
      const obj = JSON.parse(input);
      const age = Number(obj.age);
      const score = Number(obj.score);
      const role = obj.role;
      output = eval(question.formula);
    }

    res.json({ output });

  } catch (err) {
    console.log("TEST ERROR:", err);
    res.json({ result: "error" });
  }
};
exports.startGame = async (req, res) => {
  try {

    const { team_name, round } = req.body;

    // 🔴 1️⃣ Check if team already eliminated
    const eliminatedSession = await GameSession.findOne({
  team_name,
  round,
  status: "eliminated"
});


    if (eliminatedSession) {
      return res.json({
        status: "blocked",
        message: "Team already eliminated"
      });
    }

    // 🔵 2️⃣ Check if active session exists (refresh case)
    const existingSession = await GameSession.findOne({
      team_name,
      round,
      status: "active"
    });

    if (existingSession) {
      const question = await Question.findById(existingSession.question_id);

      return res.json({
        session_id: existingSession._id,
        variables: question.variables,
        end_time: existingSession.end_time
      });
    }

    // 🟡 3️⃣ Prevent restarting completed round
    const completedSession = await GameSession.findOne({
      team_name,
      round,
      status: "completed"
    });

    if (completedSession) {
      return res.json({
        status: "already_completed"
      });
    }

    // 🟢 4️⃣ Create new session normally
    const questions = await Question.find({ round });

    if (!questions.length) {
      return res.json({ message: "No questions found" });
    }

    const question =
      questions[Math.floor(Math.random() * questions.length)];

    const start = new Date();
    const end = new Date(start.getTime() + question.duration * 1000);

    const session = await GameSession.create({
      team_name,
      question_id: question._id,
      round,
      start_time: start,
      end_time: end,
      status: "active"
    });

    res.json({
      session_id: session._id,
      variables: question.variables,
      end_time: end
    });

  } catch (error) {
    console.log("START ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};


exports.submitAnswer = async (req, res) => {
  try {

    const { session_id, answer } = req.body;

    const session = await GameSession
      .findById(session_id)
      .populate("question_id");

    if (!session) return res.json({ result: "error" });

    if (new Date() > session.end_time) {
      session.status = "eliminated";
      await session.save();
      return res.json({ result: "time_over" });
    }

    const question = session.question_id;
    const explanation = answer.toLowerCase();

    // =============================
    // ROUND 1 → Exact Logic Match
    // =============================
    if (question.round === 1) {

      let allCorrect = true;

      for (let i = 0; i < 5; i++) {

        const x = Math.floor(Math.random() * 20) + 1;
        const y = Math.floor(Math.random() * 20) + 1;

        let correctOutput = eval(question.formula);
        let userOutput = eval(answer);

        if (String(correctOutput) !== String(userOutput)) {
          allCorrect = false;
          break;
        }
      }

      if (allCorrect) {

    const now = new Date();

    const timeUsedSeconds =
        Math.floor((now - session.start_time) / 1000);

    const totalDuration = question.duration; // 480 seconds (8 min)

    // Reduce only 50% max
    let score =
        100 - Math.floor((timeUsedSeconds / totalDuration) * 50);

    if (score < 50) score = 50; // minimum 50

    session.status = "completed";
    session.score = score;

    await session.save();

    return res.json({ result: "correct", score });
}


      session.status = "eliminated";
      await session.save();
      return res.json({ result: "wrong" });
    }

    // =============================
    // ROUND 2 → Keyword Scoring
    // =============================
    else if (question.round === 2) {

      let matchCount = 0;

      question.keywords.forEach(word => {
        if (explanation.includes(word.toLowerCase())) {
          matchCount++;
        }
      });

      const accuracy = matchCount / question.keywords.length;
      const score = Math.floor(accuracy * question.maxScore);

      session.status = "completed";
      session.score = score;

      await session.save();

      return res.json({ result: "correct", score });
    }

    // =============================
    // ROUND 3 → Structured Scoring
    // =============================
    else if (question.round === 3) {

      const evalRules = question.evaluation;
      let totalScore = 0;

      // --- Keywords (30%)
      let keywordMatches = 0;
      evalRules.requiredKeywords.forEach(k => {
        if (explanation.includes(k)) keywordMatches++;
      });

      totalScore +=
        (keywordMatches / evalRules.requiredKeywords.length) *
        evalRules.weight.keywords;

      // --- Logical Operators (30%)
      let logicMatches = 0;
      evalRules.logicalOperators.forEach(op => {
        if (explanation.includes(op)) logicMatches++;
      });

      totalScore +=
        (logicMatches / evalRules.logicalOperators.length) *
        evalRules.weight.logic;

      // --- Comparisons (40%)
      let comparisonMatches = 0;
      evalRules.comparisons.forEach(c => {
        if (explanation.includes(c)) comparisonMatches++;
      });

      totalScore +=
        (comparisonMatches / evalRules.comparisons.length) *
        evalRules.weight.comparisons;

      const finalScore = Math.floor(totalScore);

      session.status = "completed";
      session.score = finalScore;

      await session.save();

      return res.json({ result: "correct", score: finalScore });
    }

  } catch (err) {
    console.log(err);
    res.json({ result: "error" });
  }
};


exports.leaderboard = async (req, res) => {
  try {

    const leaderboard = await GameSession.aggregate([
      {
        $group: {
          _id: "$team_name",
          totalScore: { $sum: "$score" }
        }
      },
      {
        $sort: { totalScore: -1 }
      }
    ]);

    res.json(leaderboard);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
