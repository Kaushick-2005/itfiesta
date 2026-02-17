/* Node.js backend for IT Fiesta Escape Room
   Uses Express and MongoDB Atlas
   
   MongoDB Setup:
   1. Create a cluster on MongoDB Atlas
   2. Get connection string: mongodb+srv://<user>:<pass>@cluster.mongodb.net/?retryWrites=true&w=majority
   3. Create .env file with MONGO_URI
*/

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

console.log('ENV USE_SAMPLE_DB=', process.env.USE_SAMPLE_DB);
let USE_SAMPLE_DB = process.env.USE_SAMPLE_DB === 'true';
let MONGO_CONNECTED = false;
let MONGO_LAST_ERROR = null;

// Connect to MongoDB with retries. IMPORTANT: do NOT silently switch to SAMPLE DB when the config requests MongoDB.
async function connectWithRetry(retries = 3, delayMs = 3000) {
  if (USE_SAMPLE_DB) {
    console.log('⚠️ Running in SAMPLE DB mode (no MongoDB connection)');
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempting MongoDB connect (attempt ${attempt}/${retries})...`);
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
      });
      MONGO_CONNECTED = true;
      console.log('✓ MongoDB connected');
      return;
    } catch (err) {
      MONGO_LAST_ERROR = err.message;
      console.warn(`MongoDB connect attempt ${attempt} failed:`, err.message);
      if (attempt < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }

  console.error('MongoDB connection failed after retries. Server will remain running but questions endpoint requires DB.');
}

connectWithRetry();

// ============ SCHEMAS ============

const questionSchema = new mongoose.Schema({
  level: Number,
  category: String,
  type: String,
  question: String,
  options: [String],
  answer: mongoose.Schema.Types.Mixed, // supports string/array/object formats
  marks: Number,
  createdAt: { type: Date, default: Date.now }
}, { strict: false });

const teamSchema = new mongoose.Schema({
  teamId: { type: String, unique: true, required: true },
  teamName: String,
  teamMembers: { type: [String], default: [] },
  username: { type: String, unique: true, required: true },
  password: String,
  level1_score: { type: Number, default: 0 },
  level2_score: { type: Number, default: 0 },
  level3_score: { type: Number, default: 0 },
  level4_score: { type: Number, default: 0 },
  level5_score: { type: Number, default: 0 },
  level1_submitted: { type: Boolean, default: false },
  level2_submitted: { type: Boolean, default: false },
  level3_submitted: { type: Boolean, default: false },
  level4_submitted: { type: Boolean, default: false },
  level5_submitted: { type: Boolean, default: false },
  level1_solvedAt: { type: String, default: null },
  level2_solvedAt: { type: String, default: null },
  level3_solvedAt: { type: String, default: null },
  level4_solvedAt: { type: String, default: null },
  level5_solvedAt: { type: String, default: null },
  level1_attempts: { type: Number, default: 0 },
  level2_attempts: { type: Number, default: 0 },
  level3_attempts: { type: Number, default: 0 },
  level4_attempts: { type: Number, default: 0 },
  level5_attempts: { type: Number, default: 0 },
  level1_submission: { type: String, default: null },
  level2_submission: { type: String, default: null },
  level3_submission: { type: String, default: null },
  level4_submission: { type: String, default: null },
  level5_submission: { type: String, default: null },
  eliminated: { type: Boolean, default: false },
  eliminatedAt: { type: String, default: null },
  violationRecords: [{ reason: String, timestamp: String }],
  currentLevel: { type: Number, default: 1 },
  winner: { type: Boolean, default: false },
  winnerAt: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const levelDefinitionSchema = new mongoose.Schema({
  level: { type: Number, unique: true, required: true },
  prompt: String,
  correctAnswer: String,
  attemptsAllowed: { type: Number, default: 0 },
  durationSeconds: { type: Number, default: 300 },
  createdAt: { type: Date, default: Date.now }
});

const levelQualifiedSchema = new mongoose.Schema({
  level: { type: Number, unique: true, required: true },
  qualifiedTeamIds: { type: [String], default: [] },
  qualifiedAt: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

let Question, Team;

// In-memory sample DB helpers (used when USE_SAMPLE_DB = true)
const sampleQuestions = [];
const sampleTeams = [];

if (USE_SAMPLE_DB) {
  // minimal id generator
  const genId = () => Math.random().toString(36).slice(2, 10);

  Question = {
    find: async (filter) => {
      if (!filter || !('level' in filter)) return sampleQuestions.slice();
      return sampleQuestions.filter(q => q.level == filter.level);
    },
    deleteMany: async () => { sampleQuestions.length = 0; },
    insertMany: async (arr) => {
      const toInsert = arr.map(q => ({ ...q, _id: genId(), createdAt: new Date().toISOString() }));
      sampleQuestions.push(...toInsert);
      return toInsert;
    }
  };

  Team = {
    create: async (data) => {
      const existingById = sampleTeams.find(t => t.teamId === data.teamId);
      const existingByUser = sampleTeams.find(t => t.username === data.username);
      if (existingById || existingByUser) {
        const err = new Error('Duplicate teamId or username');
        err.code = 11000;
        throw err;
      }
      const team = {
        _id: genId(),
        teamId: data.teamId,
        teamName: data.teamName,
        teamMembers: Array.isArray(data.teamMembers) ? data.teamMembers : [],
        username: data.username,
        password: data.password,
        level1_score: 0,
        level2_score: 0,
        level3_score: 0,
        level4_score: 0,
        level5_score: 0,
        level1_submitted: false,
        level2_submitted: false,
        level3_submitted: false,
        level4_submitted: false,
        level5_submitted: false,
        level1_solvedAt: null,
        level2_solvedAt: null,
        level3_solvedAt: null,
        level4_solvedAt: null,
        level5_solvedAt: null,
        level1_attempts: 0,
        level2_attempts: 0,
        level3_attempts: 0,
        level4_attempts: 0,
        level5_attempts: 0,
        level1_submission: null,
        level2_submission: null,
        level3_submission: null,
        level4_submission: null,
        level5_submission: null,
        eliminated: false,
        eliminatedAt: null,
        violationRecords: [],
        currentLevel: 1,
        winner: false,
        winnerAt: null,
        createdAt: new Date().toISOString()
      };
      sampleTeams.push(team);
      return team;
    },
    findOne: async (filter) => {
      if (filter.username) return sampleTeams.find(t => t.username === filter.username) || null;
      if (filter.teamId) return sampleTeams.find(t => t.teamId === filter.teamId) || null;
      // fallback
      return null;
    },
    find: async () => sampleTeams.slice(),
    saveTeam: async (teamObj) => {
      const idx = sampleTeams.findIndex(t => t.teamId === teamObj.teamId);
      if (idx === -1) {
        sampleTeams.push(teamObj);
      } else {
        sampleTeams[idx] = teamObj;
      }
      return teamObj;
    }
  };
} else {
  Question = mongoose.model('Question', questionSchema);
  Team = mongoose.model('Team', teamSchema);
}

// Level definitions (admin-defined prompts and correct answers)
let LevelDefinition;
const sampleLevelDefinitions = [];
let LevelQualified;
const sampleLevelQualified = [];
if (USE_SAMPLE_DB) {
  LevelDefinition = {
    findOne: async (filter) => sampleLevelDefinitions.find(d => d.level === filter.level) || null,
    upsert: async (level, obj) => {
      const idx = sampleLevelDefinitions.findIndex(d => d.level === level);
      if (idx === -1) sampleLevelDefinitions.push({ level, ...obj });
      else sampleLevelDefinitions[idx] = { level, ...obj };
      return sampleLevelDefinitions.find(d => d.level === level);
    }
  };

  LevelQualified = {
    findOne: async (filter) => sampleLevelQualified.find(d => d.level === filter.level) || null,
    find: async () => sampleLevelQualified.slice(),
    upsert: async (level, obj) => {
      const idx = sampleLevelQualified.findIndex(d => d.level === level);
      const now = new Date();
      if (idx === -1) {
        sampleLevelQualified.push({ level, qualifiedTeamIds: [], qualifiedAt: null, createdAt: now, updatedAt: now, ...obj });
      } else {
        sampleLevelQualified[idx] = { ...sampleLevelQualified[idx], ...obj, level, updatedAt: now };
      }
      return sampleLevelQualified.find(d => d.level === level);
    }
  };
} else {
  LevelDefinition = mongoose.models.LevelDefinition || mongoose.model('LevelDefinition', levelDefinitionSchema);
  LevelQualified = mongoose.models.LevelQualified || mongoose.model('LevelQualified', levelQualifiedSchema);
}

function normalizeTeamId(raw) {
  return String(raw || '').trim().toUpperCase();
}

function uniqueTeamIds(ids) {
  const seen = new Set();
  const out = [];
  (ids || []).forEach(id => {
    const norm = normalizeTeamId(id);
    if (!norm) return;
    if (seen.has(norm)) return;
    seen.add(norm);
    out.push(norm);
  });
  return out;
}

async function getQualifiedDoc(level) {
  if (USE_SAMPLE_DB) {
    return await LevelQualified.findOne({ level });
  }
  return await LevelQualified.findOne({ level });
}

async function upsertQualifiedDoc(level, teamIds) {
  const normalized = uniqueTeamIds(teamIds);
  const qualifiedAt = new Date().toISOString();

  if (USE_SAMPLE_DB) {
    return await LevelQualified.upsert(level, { qualifiedTeamIds: normalized, qualifiedAt });
  }

  let doc = await LevelQualified.findOne({ level });
  if (!doc) {
    doc = new LevelQualified({ level, qualifiedTeamIds: normalized, qualifiedAt });
  } else {
    doc.qualifiedTeamIds = normalized;
    doc.qualifiedAt = qualifiedAt;
    doc.updatedAt = new Date();
  }
  await doc.save();
  return doc;
}

async function addQualifiedTeamId(level, teamId) {
  const normalizedTeamId = normalizeTeamId(teamId);
  if (!normalizedTeamId) return null;

  const existing = await getQualifiedDoc(level);
  const current = existing && Array.isArray(existing.qualifiedTeamIds)
    ? existing.qualifiedTeamIds
    : [];
  const merged = uniqueTeamIds([...(current || []), normalizedTeamId]);
  return await upsertQualifiedDoc(level, merged);
}

// DB status endpoint
app.get('/api/db-status', (req, res) => {
  res.json({ useSampleDb: USE_SAMPLE_DB, mongoConnected: MONGO_CONNECTED, lastError: MONGO_LAST_ERROR });
});

// Admin: define level prompt/answer
app.post('/api/admin/define-level/:level', async (req, res) => {
  try {
    const lvl = Number(req.params.level);
    const { prompt, correctAnswer, attemptsAllowed, durationSeconds } = req.body;
    const defaultDurations = { 1: 180, 2: 240, 3: 300, 4: 360, 5: 600 };
    const normalizedDuration = Number(durationSeconds) || defaultDurations[lvl] || 300;
    if (USE_SAMPLE_DB) {
      const def = await LevelDefinition.upsert(lvl, { prompt, correctAnswer, attemptsAllowed, durationSeconds: normalizedDuration });
      return res.json({ success: true, def });
    }
    const existing = await LevelDefinition.findOne({ level: lvl });
    if (existing) {
      existing.prompt = prompt;
      existing.correctAnswer = correctAnswer;
      existing.attemptsAllowed = attemptsAllowed || 0;
      existing.durationSeconds = normalizedDuration || existing.durationSeconds;
      await existing.save();
      return res.json({ success: true, def: existing });
    }
    const def = new LevelDefinition({ level: lvl, prompt, correctAnswer, attemptsAllowed: attemptsAllowed || 0, durationSeconds: normalizedDuration });
    await def.save();
    res.json({ success: true, def });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get qualified team numbers by level
app.get('/api/admin/qualified-teams', async (req, res) => {
  try {
    const levels = [1, 2, 3, 4, 5];
    const out = [];
    for (const level of levels) {
      const doc = await getQualifiedDoc(level);
      out.push({
        level,
        qualifiedTeamIds: uniqueTeamIds((doc && doc.qualifiedTeamIds) || []),
        qualifiedAt: doc && doc.qualifiedAt ? doc.qualifiedAt : null
      });
    }
    res.json({ success: true, levels: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: set qualified team numbers for a level
app.post('/api/admin/qualified-teams/:level', async (req, res) => {
  try {
    const level = Number(req.params.level);
    if (!Number.isFinite(level) || level < 1 || level > 5) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    const payload = req.body && req.body.teamIds;
    const teamIds = Array.isArray(payload)
      ? payload
      : String(payload || '').split(',');
    const normalized = uniqueTeamIds(teamIds);

    const missingTeamIds = [];
    const existingTeamIds = [];
    for (const id of normalized) {
      const t = await Team.findOne({ teamId: id });
      if (t) existingTeamIds.push(id);
      else missingTeamIds.push(id);
    }

    const doc = await upsertQualifiedDoc(level, existingTeamIds);
    res.json({
      success: true,
      level,
      qualifiedTeamIds: uniqueTeamIds((doc && doc.qualifiedTeamIds) || []),
      missingTeamIds
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: add one qualified team number to a level
app.post('/api/admin/qualified-teams/:level/add', async (req, res) => {
  try {
    const level = Number(req.params.level);
    if (!Number.isFinite(level) || level < 1 || level > 5) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    const teamId = normalizeTeamId(req.body && req.body.teamId);
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    const team = await Team.findOne({ teamId });
    if (!team) return res.status(404).json({ error: 'Team not found for provided team number' });

    const doc = await addQualifiedTeamId(level, teamId);
    res.json({ success: true, level, qualifiedTeamIds: uniqueTeamIds((doc && doc.qualifiedTeamIds) || []) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public: get definition for a level (clients need prompt and duration)
app.get('/api/level/:level/definition', async (req, res) => {
  try {
    const lvl = Number(req.params.level);
    if (USE_SAMPLE_DB) {
      const def = await LevelDefinition.findOne({ level: lvl });
      if (!def) return res.status(404).json({ error: 'No definition' });
      return res.json(def);
    }
    if (!MONGO_CONNECTED) return res.status(503).json({ error: 'DB not connected' });
    const def = await LevelDefinition.findOne({ level: lvl });
    if (!def) return res.status(404).json({ error: 'No definition' });
    res.json(def);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Participant submits an answer for a survival gate level
app.post('/api/levels/:level/submit', async (req, res) => {
  try {
    const lvl = Number(req.params.level);
    const { teamId, answer, questionId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    const given = (answer || '').toString().trim();

    if (!USE_SAMPLE_DB && !MONGO_CONNECTED) return res.status(503).json({ error: 'DB not connected' });

    // fetch team early (needed for both definition-based and dataset-based validation)
    const team = USE_SAMPLE_DB ? await Team.findOne({ teamId }) : await Team.findOne({ teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const definition = USE_SAMPLE_DB ? await LevelDefinition.findOne({ level: lvl }) : await LevelDefinition.findOne({ level: lvl });

    // helper: normalize strings for comparison
    function norm(s){ if (s === undefined || s === null) return ''; return String(s).trim().toLowerCase().replace(/\s+/g,' '); }

    // For competitive levels, prefer dataset-based validation (and fallback to definition rules if needed)
    // Also use dataset validation whenever no definition exists.
    if (!definition || [2, 3, 4].includes(lvl)) {
      // load question pool for the level (supports different doc shapes)
      let pool = [];
      if (USE_SAMPLE_DB) {
        pool = await Question.find({ level: lvl });
      } else {
        // ensure model exists
        const QModel = mongoose.models.Question || mongoose.model('Question', questionSchema);
        pool = await QModel.find({ level: lvl }).lean();
      }

      // flatten possible nested question payloads (e.g. level-3 documents with questions[])
      const expandedPool = [];
      for (const q of pool) {
        expandedPool.push(q);
        if (Array.isArray(q.questions)) {
          q.questions.forEach(function(sub){
            if (sub && typeof sub === 'object') expandedPool.push(sub);
          });
        }
      }

      // If client provides questionId (especially for competitive ordered-actions rounds),
      // validate only against that exact DB record.
      let candidatePool = expandedPool;
      if (questionId) {
        const qid = String(questionId);
        candidatePool = expandedPool.filter(function(q){
          return q && q._id && String(q._id) === qid;
        });
      }

      // try to find a matching question entry
      let matched = null;
      const submitted = norm(given);
      for (const q of candidatePool) {
        // MCQ style: 'answer' is a string
        if (q.answer && typeof q.answer === 'string') {
          if (norm(q.answer) === submitted) { matched = { q, kind: 'mcq' }; break; }
        }
        // drag-drop order: 'answer' may be an array
        if (Array.isArray(q.answer)) {
          // compare as comma-separated normalized lists
          const correct = q.answer.map(a=>norm(a)).join(',');
          if (submitted === correct || submitted === q.answer.join(',').toLowerCase()) { matched = { q, kind: 'order' }; break; }
          // also accept if user submitted indices like "1,3,2" matching the positions
          const idxs = given.toString().split(',').map(x=>x.trim()).filter(x=>x.length>0);
          if (idxs.length === q.answer.length) {
            const byIndex = idxs.map(i=>{
              const n = parseInt(i,10);
              return (!isNaN(n) && q.items && q.items[n-1]) ? norm(q.items[n-1]) : null;
            });
            if (byIndex.every(x=>x!==null) && byIndex.join(',') === q.answer.map(a=>norm(a)).join(',')) { matched = { q, kind: 'order_index' }; break; }
          }
        }
        // logic_code documents: may include final_code
        if (q.final_code) {
          if (norm(q.final_code) === submitted) { matched = { q, kind: 'logic_code' }; break; }
        }
        // ordered_actions: correct_order is array of indices (1-based)
        if (Array.isArray(q.correct_order)) {
          // accept if user submits comma-separated indices matching correct_order
          const idxs = given.toString().split(',').map(x=>x.trim()).filter(x=>x.length>0).map(x=>parseInt(x,10));
          if (idxs.length === q.correct_order.length && idxs.every(n=>!isNaN(n))) {
            const same = idxs.every((v,i)=> v === q.correct_order[i]);
            if (same) { matched = { q, kind: 'ordered_actions' }; break; }
          }
          // accept if user submits action texts in order
          const submittedParts = given.toString().split(',').map(p=>norm(p));
          const correctParts = q.correct_order.map(i=> norm(q.actions[i-1] || ''));
          if (submittedParts.length === correctParts.length && submittedParts.join(',') === correctParts.join(',')) { matched = { q, kind: 'ordered_actions_text' }; break; }
        }
      }

      if (matched) {
        // Persist completion for admin leaderboard/qualification views.
        if (!team.currentLevel) team.currentLevel = 1;
        team[`level${lvl}_submitted`] = true;
        team[`level${lvl}_solvedAt`] = new Date().toISOString();

        const marks = Number(matched.q && matched.q.marks);
        if (Number.isFinite(marks) && marks > 0) {
          team[`level${lvl}_score`] = Math.max(Number(team[`level${lvl}_score`] || 0), marks);
        }

        if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
        return res.json({ success: true, result: 'correct', matchedKind: matched.kind, matchedQuestion: matched.q, team });
      }

      // Level 4 is strict survival-gate: any non-exact sequence is immediate elimination.
      if (lvl === 4) {
        team.eliminated = true;
        team.eliminatedAt = new Date().toISOString();
        team.violationRecords = team.violationRecords || [];
        team.violationRecords.push({ reason: 'incorrect_answer', timestamp: new Date().toISOString() });
        if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
        return res.json({ success: true, result: 'eliminated', team });
      }

      // no matched question found. If no admin definition exists, this is an immediate survival-gate failure.
      if (!definition) {
        team.eliminated = true;
        team.eliminatedAt = new Date().toISOString();
        team.violationRecords = team.violationRecords || [];
        team.violationRecords.push({ reason: 'incorrect_answer', timestamp: new Date().toISOString() });
        if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
        return res.json({ success: true, result: 'eliminated', team });
      }
    }

    // normalize comparison
    const expected = (definition.correctAnswer || '').toString().trim();

    // Special-case: automated pass for coding challenges (Level 5)
    // If admin sets correctAnswer to '__auto__', the client-side test will submit 'PASSED'
    // and the server should accept it as correct so we can record solve timestamp for ranking.
    if (expected === '__auto__' && given === 'PASSED') {
      if (!team.currentLevel) team.currentLevel = 1;
      team[`level${lvl}_submitted`] = true;
      team[`level${lvl}_solvedAt`] = new Date().toISOString();
      if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
      return res.json({ success: true, result: 'correct', team });
    }

    // Special-case: manual review mode. When admin sets correctAnswer to '__manual__', accept submission and store it for review.
    if (definition.correctAnswer === '__manual__') {
      // store submission payload for admin review
      team[`level${lvl}_submission`] = given;
      team[`level${lvl}_submitted`] = true;
      if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
      return res.json({ success: true, result: 'submitted_for_review', team });
    }

    const match = expected.toLowerCase() === given.toLowerCase();
    if (match) {
      // mark solved; admin decides qualification/advancement manually
      if (!team.currentLevel) team.currentLevel = 1;
      // record solve timestamp for competitive ranking
      team[`level${lvl}_solvedAt`] = new Date().toISOString();
      // mark submitted
      team[`level${lvl}_submitted`] = true;
      if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
      return res.json({ success: true, result: 'correct', team });
    }

    // incorrect => either decrement attempts or eliminate
    const attemptsAllowed = definition.attemptsAllowed || 0;
    if (attemptsAllowed > 0) {
      team[`level${lvl}_attempts`] = (team[`level${lvl}_attempts`] || 0) + 1;
      const attemptsUsed = team[`level${lvl}_attempts`];
      if (attemptsUsed >= attemptsAllowed) {
        team.eliminated = true;
        team.eliminatedAt = new Date().toISOString();
        team.violationRecords = team.violationRecords || [];
        team.violationRecords.push({ reason: (req.body && req.body.reason) ? req.body.reason : 'max_attempts', timestamp: new Date().toISOString() });
      }
      if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
      return res.json({ success: true, result: 'incorrect', attemptsUsed, attemptsAllowed, team });
    }

    // no attempts allowed -> immediate elimination
    team.eliminated = true;
    team.eliminatedAt = new Date().toISOString();
    team.violationRecords = team.violationRecords || [];
    team.violationRecords.push({ reason: (req.body && req.body.reason) ? req.body.reason : 'eliminated', timestamp: new Date().toISOString() });
    if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
    res.json({ success: true, result: 'eliminated', team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ROUTES ============

// GET /api/questions/:level - Fetch questions for a level
app.get('/api/questions/:level', async (req, res) => {
  try {
    const levelParam = String(req.params.level);
    const levelNumber = Number(levelParam);
    const levelFilters = Number.isNaN(levelNumber)
      ? [{ level: levelParam }]
      : [{ level: levelNumber }, { level: String(levelNumber) }];

    // Questions must be served from MongoDB only. Do not use sample DB for questions.
    if (USE_SAMPLE_DB) {
      return res.status(503).json({ error: 'Questions must be served from MongoDB. Server running in SAMPLE DB mode; enable MongoDB connection and set USE_SAMPLE_DB=false.' });
    }

    // Ensure mongoose model exists (in case models were not registered earlier)
    if (!mongoose.models || !mongoose.models.Question) {
      mongoose.model('Question', questionSchema);
    }
    const QModel = mongoose.models.Question;

    let questions = await QModel.find({ $or: levelFilters });

    // Auto-import local dataset when DB has no questions for requested level.
    if (!questions || questions.length === 0) {
      try {
        const datasetPath = path.join(__dirname, '..', 'questions dataset.json');
        if (fs.existsSync(datasetPath)) {
          const raw = fs.readFileSync(datasetPath, 'utf-8');
          const docs = JSON.parse(raw);
          if (Array.isArray(docs) && docs.length > 0) {
            const existingCount = await QModel.estimatedDocumentCount();
            const normalized = docs
              .filter(d => d && typeof d === 'object' && d.level !== undefined && d.level !== null)
              .map(d => {
                const copy = { ...d };
                delete copy._id;
                return copy;
              });

            if (existingCount === 0) {
              await QModel.insertMany(normalized, { ordered: false });
            } else {
              const seedForLevel = normalized.filter(d => {
                return Number.isNaN(levelNumber)
                  ? String(d.level) === levelParam
                  : String(d.level) === String(levelNumber);
              });
              if (seedForLevel.length > 0) {
                await QModel.insertMany(seedForLevel, { ordered: false });
              }
            }

            questions = await QModel.find({ $or: levelFilters });
          }
        }
      } catch (seedErr) {
        console.warn('Auto-import questions dataset failed:', seedErr.message);
      }
    }

    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Server-synced timer: returns a server timestamp and recommended level duration
app.get('/api/level/:level/start', async (req, res) => {
  try {
    const level = Number(req.params.level);
    const durations = { 1: 180, 2: 240, 3: 300, 4: 360, 5: 600 };
    const duration = durations[level] || 300;

    if (!USE_SAMPLE_DB && !MONGO_CONNECTED) {
      return res.json({ serverNow: Date.now(), duration });
    }

    const serverNow = Date.now();
    res.json({ serverNow, duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/register - Register a new team (admin side)
app.post('/api/teams/register', async (req, res) => {
  try {
    const { teamId, teamName, username, password } = req.body;
    const teamMembers = Array.isArray(req.body && req.body.teamMembers)
      ? req.body.teamMembers.map(v => String(v || '').trim()).filter(Boolean)
      : [];
    if (USE_SAMPLE_DB) {
      const team = await Team.create({ teamId, teamName, teamMembers, username, password });
      return res.json({ success: true, team });
    }
    const team = new Team({ teamId, teamName, teamMembers, username, password });
    await team.save();
    res.json({ success: true, team });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/teams/ensure - Ensure a team exists (Level 1 open access)
app.post('/api/teams/ensure', async (req, res) => {
  try {
    const rawTeamId = (req.body && req.body.teamId) ? String(req.body.teamId).trim() : '';
    if (!rawTeamId) return res.status(400).json({ error: 'teamId required' });

    const teamId = rawTeamId.toUpperCase();
    const requestedName = (req.body && req.body.teamName) ? String(req.body.teamName).trim() : '';
    const teamMembers = Array.isArray(req.body && req.body.teamMembers)
      ? req.body.teamMembers.map(v => String(v || '').trim()).filter(Boolean)
      : [];
    let team = await Team.findOne({ teamId });
    if (team) {
      // Keep existing login credentials, but allow updating display metadata.
      let changed = false;
      if (requestedName && requestedName !== team.teamName) {
        team.teamName = requestedName;
        changed = true;
      }
      if (teamMembers.length > 0) {
        team.teamMembers = teamMembers;
        changed = true;
      }
      if (changed) {
        if (USE_SAMPLE_DB) await Team.saveTeam(team); else await team.save();
      }
      return res.json({ success: true, created: false, team });
    }

    const teamName = requestedName || (`Team ${teamId}`);
    const usernameBase = teamId;

    // ensure username uniqueness
    let username = usernameBase;
    let counter = 1;
    while (await Team.findOne({ username })) {
      username = `${usernameBase}_${counter++}`;
    }

    if (USE_SAMPLE_DB) {
      team = await Team.create({ teamId, teamName, teamMembers, username, password: username });
      return res.json({ success: true, created: true, team });
    }

    team = new Team({
      teamId,
      teamName,
      teamMembers,
      username,
      password: username,
      currentLevel: 1,
      eliminated: false
    });
    await team.save();
    res.json({ success: true, created: true, team });
  } catch (err) {
    // race-safe fallback
    try {
      const rawTeamId = (req.body && req.body.teamId) ? String(req.body.teamId).trim() : '';
      const teamId = rawTeamId.toUpperCase();
      if (teamId) {
        const existing = await Team.findOne({ teamId });
        if (existing) return res.json({ success: true, created: false, team: existing });
      }
    } catch (_) {}
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/login - Login with username/password (user side)
app.post('/api/teams/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const team = await Team.findOne({ username });
    if (!team || team.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/submit - Submit answers for a level
app.post('/api/teams/:teamId/submit', async (req, res) => {
  try {
    const { level, score } = req.body;
    if (USE_SAMPLE_DB) {
      const team = await Team.findOne({ teamId: req.params.teamId });
      if (!team) return res.status(404).json({ error: 'Team not found' });
      const scoreField = `level${level}_score`;
      const submittedField = `level${level}_submitted`;
      team[scoreField] = score;
      team[submittedField] = true;
      team[`level${level}_solvedAt`] = new Date().toISOString();
      await Team.saveTeam(team);
      return res.json({ success: true, team });
    }

    const { level: lvl, score: sc } = req.body;
    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const scoreField = `level${lvl}_score`;
    const submittedField = `level${lvl}_submitted`;
    
    team[scoreField] = sc;
    team[submittedField] = true;
    team[`level${lvl}_solvedAt`] = new Date().toISOString();
    
    await team.save();
    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams - List all teams with scores
app.get('/api/teams', async (req, res) => {
  try {
    if (USE_SAMPLE_DB) {
      const teams = await Team.find();
      // sort: not-eliminated first, then level1_score desc
      teams.sort((a, b) => {
        if (a.eliminated === b.eliminated) return (b.level1_score || 0) - (a.level1_score || 0);
        return (a.eliminated ? 1 : 0) - (b.eliminated ? 1 : 0);
      });
      return res.json(teams);
    }
    const teams = await Team.find().sort({ eliminated: 1, level1_score: -1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/eliminate - Mark team as eliminated
app.post('/api/teams/:teamId/eliminate', async (req, res) => {
  try {
    const reason = req.body && req.body.reason ? req.body.reason : (req.query && req.query.reason ? req.query.reason : 'rule_violation');
    if (USE_SAMPLE_DB) {
      const team = await Team.findOne({ teamId: req.params.teamId });
      if (!team) return res.status(404).json({ error: 'Team not found' });
      team.eliminated = true;
      team.eliminatedAt = new Date().toISOString();
      team.violationRecords = team.violationRecords || [];
      team.violationRecords.push({ reason, timestamp: new Date().toISOString() });
      await Team.saveTeam(team);
      return res.json({ success: true, team });
    }

    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    team.eliminated = true;
    team.eliminatedAt = new Date().toISOString();
    team.violationRecords = team.violationRecords || [];
    team.violationRecords.push({ reason, timestamp: new Date().toISOString() });
    await team.save();

    res.json({ success: true, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:teamId/advance - Allow admin to advance a team to next level
app.post('/api/teams/:teamId/advance', async (req, res) => {
  try {
    const overrideElimination = !!(req.body && req.body.overrideElimination);

    if (USE_SAMPLE_DB) {
      const team = await Team.findOne({ teamId: req.params.teamId });
      if (!team) return res.status(404).json({ error: 'Team not found' });

      const fromLevel = Number(team.currentLevel || 1);

      if (team.eliminated && !overrideElimination) {
        return res.status(400).json({ error: 'Team is eliminated. Use overrideElimination to reinstate and advance.' });
      }

      if (team.eliminated && overrideElimination) {
        team.eliminated = false;
        team.eliminatedAt = null;
        // Admin override is an exceptional decision and should not be logged as a violation.
        // For Level 3 manual-decision flow, also clear latest incorrect-answer violation if present.
        if (fromLevel === 3 && Array.isArray(team.violationRecords)) {
          for (let i = team.violationRecords.length - 1; i >= 0; i--) {
            if (String(team.violationRecords[i] && team.violationRecords[i].reason || '') === 'incorrect_answer') {
              team.violationRecords.splice(i, 1);
              break;
            }
          }
        }
      }

      if (fromLevel >= 1 && fromLevel <= 5) {
        await addQualifiedTeamId(fromLevel, team.teamId);
      }

      if (typeof team.currentLevel !== 'number') team.currentLevel = 1;
      if (team.currentLevel < 5) {
        team.currentLevel = team.currentLevel + 1;
      } else {
        // Final-stage admin announcement: do not move to level 6.
        team.currentLevel = 5;
        team.winner = true;
        team.winnerAt = new Date().toISOString();
      }
      await Team.saveTeam(team);
      return res.json({ success: true, fromLevel, team });
    }

    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const fromLevel = Number(team.currentLevel || 1);

    if (team.eliminated && !overrideElimination) {
      return res.status(400).json({ error: 'Team is eliminated. Use overrideElimination to reinstate and advance.' });
    }

    if (team.eliminated && overrideElimination) {
      team.eliminated = false;
      team.eliminatedAt = null;
      // Admin override is an exceptional decision and should not be logged as a violation.
      // For Level 3 manual-decision flow, also clear latest incorrect-answer violation if present.
      if (fromLevel === 3 && Array.isArray(team.violationRecords)) {
        for (let i = team.violationRecords.length - 1; i >= 0; i--) {
          if (String(team.violationRecords[i] && team.violationRecords[i].reason || '') === 'incorrect_answer') {
            team.violationRecords.splice(i, 1);
            break;
          }
        }
      }
    }

    if (fromLevel >= 1 && fromLevel <= 5) {
      await addQualifiedTeamId(fromLevel, team.teamId);
    }

    // increment currentLevel by 1 until level 5 only.
    // Winner is announced on admin advance at final stage without creating level 6.
    if (typeof team.currentLevel !== 'number') team.currentLevel = 1;
    if (team.currentLevel < 5) {
      team.currentLevel = team.currentLevel + 1;
    } else {
      team.currentLevel = 5;
      team.winner = true;
      team.winnerAt = new Date().toISOString();
    }
    await team.save();

    res.json({ success: true, fromLevel, team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:teamId - Get single team details
app.get('/api/teams/:teamId', async (req, res) => {
  try {
    const team = await Team.findOne({ teamId: req.params.teamId });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============ SEED QUESTIONS (optional) ============
app.post('/api/import-questions-json', async (req, res) => {
  try {
    if (!USE_SAMPLE_DB && !MONGO_CONNECTED) {
      return res.status(503).json({ error: 'DB not connected' });
    }

    const sourcePath = (req.body && req.body.path)
      ? String(req.body.path)
      : path.join(__dirname, '..', 'questions dataset.json');

    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: `File not found: ${sourcePath}` });
    }

    const raw = fs.readFileSync(sourcePath, 'utf-8');
    const docs = JSON.parse(raw);
    if (!Array.isArray(docs) || docs.length === 0) {
      return res.status(400).json({ error: 'Dataset must be a non-empty JSON array' });
    }

    const normalized = docs
      .filter(d => d && typeof d === 'object' && typeof d.level === 'number')
      .map(d => {
        const copy = { ...d };
        // Remove mongo-export style _id object and let Mongo generate _id
        delete copy._id;
        return copy;
      });

    if (req.query && req.query.replace === 'true') {
      await Question.deleteMany({});
    }

    const inserted = await Question.insertMany(normalized, { ordered: false });
    return res.json({ success: true, count: inserted.length, sourcePath, replaced: !!(req.query && req.query.replace === 'true') });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/seed-questions', async (req, res) => {
  try {
    // Clear existing
    if (USE_SAMPLE_DB) {
      await Question.deleteMany();
    } else {
      await Question.deleteMany({});
    }
    
    const questions = [
      // Level 1 - OS
      { level: 1, category: 'os', type: 'mcq', question: 'I\'m the silent core controlling hardware, memory, and processes, yet most users never see me directly.', options: ['Kernel', 'Shell', 'Scheduler', 'Bootloader'], answer: 'Kernel', marks: 10 },
      { level: 1, category: 'os', type: 'mcq', question: 'I rapidly switch the CPU between tasks so users feel programs run at the same time.', options: ['Multithreading', 'Multiprocessing', 'Multitasking', 'Context Switching'], answer: 'Multitasking', marks: 10 },
      { level: 1, category: 'os', type: 'mcq', question: 'When RAM runs low, I borrow disk space to keep programs running.', options: ['Cache', 'Virtual Memory', 'Swap Partition', 'Paging'], answer: 'Virtual Memory', marks: 10 },
      // Level 1 - Cyber
      { level: 1, category: 'cyber', type: 'mcq', question: 'Which hashing algorithm is considered secure for password storage?', options: ['MD5', 'SHA1', 'bcrypt', 'CRC32'], answer: 'bcrypt', marks: 10 },
      { level: 1, category: 'cyber', type: 'mcq', question: 'A login form builds queries using string concatenation. What is the core security flaw?', options: ['Missing HTTPS', 'Weak hashing', 'Dynamic query construction with unsanitized input', 'Session fixation'], answer: 'Dynamic query construction with unsanitized input', marks: 10 },
      // Level 1 - Cloud
      { level: 1, category: 'cloud', type: 'mcq', question: 'In Excel, which symbol must every formula begin with?', options: ['%', '+', '=', '#'], answer: '=', marks: 10 },
      { level: 1, category: 'cloud', type: 'mcq', question: 'What does SaaS stand for in cloud computing?', options: ['Storage as a Service', 'Software as a Service', 'System as a Solution', 'Security as a Service'], answer: 'Software as a Service', marks: 10 },
      // Level 1 - AI
      { level: 1, category: 'ai', type: 'mcq', question: 'Who is often referred to as the Father of Artificial Intelligence?', options: ['Alan Turing', 'John McCarthy', 'Marvin Minsky', 'Herbert Simon'], answer: 'John McCarthy', marks: 10 },
      // Level 1 - CAM
      { level: 1, category: 'cam', type: 'mcq', question: 'I connect CPU, RAM, storage, and expansion cards into one working system.', options: ['Cabinet', 'Chipset', 'Motherboard', 'Processor'], answer: 'Motherboard', marks: 10 },
      // Level 1 - Programming
      { level: 1, category: 'programming', type: 'mcq', question: 'Which language was originally designed mainly for system programming and OS development?', options: ['Java', 'C', 'Python', 'JavaScript'], answer: 'C', marks: 10 },
      
      // Level 2 - OS
      { level: 2, category: 'os', type: 'mcq', question: 'What is the primary purpose of a process scheduler?', options: ['Allocate memory', 'Manage CPU time', 'Handle I/O', 'Manage files'], answer: 'Manage CPU time', marks: 10 },
      { level: 2, category: 'os', type: 'mcq', question: 'Which scheduling algorithm ensures fairness by giving each process equal CPU time?', options: ['FCFS', 'Round Robin', 'Priority Scheduling', 'Shortest Job First'], answer: 'Round Robin', marks: 10 },
      // Level 2 - Cyber
      { level: 2, category: 'cyber', type: 'mcq', question: 'What type of attack involves sending forged emails to trick users into revealing passwords?', options: ['Phishing', 'SQL Injection', 'DoS', 'Man-in-the-Middle'], answer: 'Phishing', marks: 10 },
      { level: 2, category: 'cyber', type: 'mcq', question: 'Which encryption method uses two keys: public and private?', options: ['Symmetric', 'Asymmetric', 'Hashing', 'Steganography'], answer: 'Asymmetric', marks: 10 },
      // Level 2 - Cloud
      { level: 2, category: 'cloud', type: 'mcq', question: 'What is the main advantage of containerization?', options: ['Faster CPU', 'Consistency across environments', 'Lower bandwidth', 'Cheaper storage'], answer: 'Consistency across environments', marks: 10 },
      { level: 2, category: 'cloud', type: 'mcq', question: 'Which cloud service model includes servers and storage?', options: ['SaaS', 'PaaS', 'IaaS', 'FaaS'], answer: 'IaaS', marks: 10 },
      
      // Level 3 - Advanced
      { level: 3, category: 'os', type: 'mcq', question: 'What is the difference between a process and a thread?', options: ['No difference', 'Threads share memory; processes do not', 'Processes are faster', 'Threads use more memory'], answer: 'Threads share memory; processes do not', marks: 10 },
      { level: 3, category: 'cyber', type: 'mcq', question: 'What is a zero-day vulnerability?', options: ['A vulnerability discovered long ago', 'A flaw unknown to software vendors', 'A bug in legacy code', 'A security patch'], answer: 'A flaw unknown to software vendors', marks: 10 },
      { level: 3, category: 'cloud', type: 'mcq', question: 'What is the principle of least privilege?', options: ['Give users maximum access', 'Give users only necessary permissions', 'Block all access', 'Grant temporary access'], answer: 'Give users only necessary permissions', marks: 10 },

      // Level 4 - Master Challenge
      { level: 4, category: 'os', type: 'mcq', question: 'What is the difference between preemptive and non-preemptive scheduling?', options: ['OS can interrupt or cannot interrupt processes', 'One uses threads, other uses processes', 'Affects only I/O operations', 'Preemptive is faster'], answer: 'OS can interrupt or cannot interrupt processes', marks: 10 },
      { level: 4, category: 'os', type: 'mcq', question: 'Which data structure is used for deadlock detection in OS?', options: ['Queue', 'Wait-for graph', 'Stack', 'Linked List'], answer: 'Wait-for graph', marks: 10 },
      { level: 4, category: 'cyber', type: 'mcq', question: 'What does the CIA triad stand for in cybersecurity?', options: ['Confidentiality, Integrity, Availability', 'Cipher, Identification, Authentication', 'Cryptography, Intrusion, Access', 'Control, Isolation, Audit'], answer: 'Confidentiality, Integrity, Availability', marks: 10 },
      { level: 4, category: 'cyber', type: 'mcq', question: 'In public-key cryptography, which key cannot be used to decrypt data encrypted with it?', options: ['Private key', 'Public key', 'Session key', 'Master key'], answer: 'Public key', marks: 10 },
      { level: 4, category: 'cloud', type: 'mcq', question: 'What is the main benefit of microservices architecture?', options: ['Single point of failure', 'Independent scaling and deployment', 'Simpler debugging', 'Lower latency'], answer: 'Independent scaling and deployment', marks: 10 },
      { level: 4, category: 'programming', type: 'mcq', question: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(n^2)'], answer: 'O(log n)', marks: 10 },
      { level: 4, category: 'ai', type: 'mcq', question: 'What technique in machine learning helps prevent overfitting by regularizing model weights?', options: ['Dropout', 'Gradient Descent', 'Cross-validation', 'Batch Normalization'], answer: 'Dropout', marks: 10 },
      { level: 4, category: 'programming', type: 'mcq', question: 'What design pattern ensures only one instance of a class exists throughout the application?', options: ['Factory', 'Singleton', 'Observer', 'Strategy'], answer: 'Singleton', marks: 10 },
    ];

    if (USE_SAMPLE_DB) {
      await Question.insertMany(questions);
    } else {
      await Question.insertMany(questions);
    }
    res.json({ success: true, count: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✓ Server running on port ${PORT}`));
