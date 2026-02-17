const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
require("dotenv").config();

const Event = require("./models/Event");
const Team = require("./models/Team");
const BatchControl = require("./models/BatchControl");
const Settings = require("./models/Settings");

const app = express();

/* ===============================
   MIDDLEWARE
================================= */

// Parse JSON & form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, "public")));

// Session (you can keep for now)
app.use(session({
    secret: "itfiesta_secret_key",
    resave: false,
    saveUninitialized: true
}));

/* ===============================
   DATABASE CONNECTION
================================= */

const DEFAULT_EVENTS = [
   { key: "escape", title: "Tech Escape Room" },
   { key: "blackbox", title: "Black Box Challenge" }
];

async function ensureDefaultEvents() {
   for (const event of DEFAULT_EVENTS) {
      await Event.findOneAndUpdate(
         { key: event.key },
         {
            $setOnInsert: {
               title: event.title,
               isActive: true
            }
         },
         { upsert: true }
      );
   }
}

async function ensureDefaultSettings() {
   await Settings.findOneAndUpdate(
      { key: "leaderboardEnabled" },
      {
         $setOnInsert: {
            value: true,
            description: "Enable/disable public leaderboard visibility"
         }
      },
      { upsert: true }
   );
}

mongoose.connect(process.env.MONGO_URI)
.then(async () => {
   console.log("MongoDB Connected ✅");
   await ensureDefaultEvents();
   console.log("Default events ready ✅");
   await ensureDefaultSettings();
   console.log("Default settings ready ✅");
})
.catch(err => console.log("MongoDB Error:", err));

/* ===============================
   ROUTES
================================= */

// Auth routes (registration, login)
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// ✅ ADMIN ROUTES (VERY IMPORTANT)
const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

// ✅ BLACKBOX ROUTES
const blackboxRoutes = require("./routes/blackbox");
app.use("/api/blackbox", blackboxRoutes);

// ✅ ESCAPE ROOM ROUTES
const escapeRoutes = require("./routes/escape");
app.use("/api/escape", escapeRoutes);

// ✅ EVENT AVAILABILITY ROUTES
const eventRoutes = require("./routes/events");
app.use("/api/events", eventRoutes);

/* ===============================
   LEADERBOARD API
================================= */

app.get('/api/leaderboard', async (req, res) => {
   try {
      const { event, mixed, batch } = req.query;

        // Check if leaderboard is enabled
        const leaderboardStatus = await Settings.findOne({ key: "leaderboardEnabled" });
        if (!leaderboardStatus || !leaderboardStatus.value) {
            return res.json([]);
        }

        // Build filter - Show teams that have batch assigned (participating teams)
        let filter = { 
            batch: { $ne: null },  // Must have batch assigned
            status: { $ne: "disqualified" }  // Exclude disqualified teams
        };
        
        if (event) {
            filter.eventType = event;
        }

      const hasBatchParam = batch && batch !== 'all';

      if (hasBatchParam) {
         const parsed = Number(batch);
         if (!Number.isNaN(parsed)) {
            filter.batch = parsed;
         }
      } else if (mixed !== 'true') {
         const batchControl = await BatchControl.findOne({ event: event || "escape" });
         // Only filter by batch if there's an active batch running
         if (batchControl && batchControl.currentBatch && batchControl.isActive) {
            filter.batch = batchControl.currentBatch;
         }
         // If no active batch, show all batches (don't filter)
      }

        // Fetch teams and sort by score (desc) then time (asc)
        const teams = await Team.find(filter)
            .select('teamId teamName eventType batch score penalty totalExamTime status')
            .lean()
            .limit(100);

        // Calculate totalScore and sort
        const rankedTeams = teams
            .map(team => ({
                ...team,
                totalScore: Math.max(0, (team.score || 0) - (team.penalty || 0))
            }))
            .sort((a, b) => {
                // Higher score first
                if (b.totalScore !== a.totalScore) {
                    return b.totalScore - a.totalScore;
                }
                // If equal score, lower time first
                return (a.totalExamTime || 0) - (b.totalExamTime || 0);
            });

        res.json(rankedTeams);

    } catch (error) {
        console.error('Leaderboard API Error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});


/* ===============================
   DEFAULT ROUTE
================================= */

app.get("/", (req, res) => {
    res.redirect("/register.html");
});

/* ===============================
   SERVER START
================================= */

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
