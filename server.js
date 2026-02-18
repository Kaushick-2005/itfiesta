const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const session = require("express-session");
const cors = require("cors");
require("dotenv").config();

const Event = require("./models/Event");
const Team = require("./models/Team");
const BatchControl = require("./models/BatchControl");
const Settings = require("./models/Settings");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "public");
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
}

function parseAllowedOrigins(rawValue) {
    return String(rawValue || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser requests (curl/postman/server-to-server)
        if (!origin) {
            return callback(null, true);
        }

        if (!allowedOrigins.length) {
            // In production without explicit CORS origins, only same-origin traffic
            // should work. Cross-origin browser calls are blocked by default.
            if (isProduction) {
                return callback(new Error("CORS origin not allowed"));
            }

            // Dev convenience: allow custom local frontends unless explicitly restricted.
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("CORS origin not allowed"));
    },
    credentials: true
};

const STATIC_ASSET_EXTENSIONS = new Set([
    ".css", ".js", ".mjs", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".avif", ".ico",
    ".bmp", ".tiff", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp4", ".webm", ".ogg", ".mp3", ".wav", ".m4a"
]);

const assetHashCache = new Map();

function isCacheBustedCandidate(assetUrl) {
    if (!assetUrl) return false;
    const cleanUrl = assetUrl.split("?")[0].split("#")[0].trim();
    if (!cleanUrl) return false;
    if (/^(https?:)?\/\//i.test(cleanUrl)) return false;
    if (/^(data:|mailto:|tel:|javascript:)/i.test(cleanUrl)) return false;
    const ext = path.extname(cleanUrl).toLowerCase();
    return STATIC_ASSET_EXTENSIONS.has(ext);
}

function resolveAssetAbsolutePath(assetUrl, htmlFilePath) {
    try {
        const cleanUrl = assetUrl.split("?")[0].split("#")[0].trim();
        const decoded = decodeURIComponent(cleanUrl);
        const htmlDir = path.dirname(htmlFilePath);
        const candidatePath = decoded.startsWith("/")
            ? path.join(PUBLIC_DIR, decoded.replace(/^\/+/, ""))
            : path.resolve(htmlDir, decoded);

        if (!candidatePath.startsWith(PUBLIC_DIR)) return null;
        if (!fs.existsSync(candidatePath)) return null;
        if (!fs.statSync(candidatePath).isFile()) return null;
        return candidatePath;
    } catch (error) {
        return null;
    }
}

function getFileContentHash(filePath) {
    try {
        const stat = fs.statSync(filePath);
        const cached = assetHashCache.get(filePath);

        if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
            return cached.hash;
        }

        const content = fs.readFileSync(filePath);
        const hash = crypto.createHash("sha1").update(content).digest("hex").slice(0, 12);
        assetHashCache.set(filePath, {
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            hash
        });
        return hash;
    } catch (error) {
        return null;
    }
}

function withVersionQuery(assetUrl, versionHash) {
    if (!versionHash) return assetUrl;
    const hashIndex = assetUrl.indexOf("#");
    const hashPart = hashIndex >= 0 ? assetUrl.slice(hashIndex) : "";
    const urlWithoutHash = hashIndex >= 0 ? assetUrl.slice(0, hashIndex) : assetUrl;

    const queryIndex = urlWithoutHash.indexOf("?");
    const basePath = queryIndex >= 0 ? urlWithoutHash.slice(0, queryIndex) : urlWithoutHash;
    const queryString = queryIndex >= 0 ? urlWithoutHash.slice(queryIndex + 1) : "";

    const params = new URLSearchParams(queryString);
    params.set("v", versionHash);

    const nextQuery = params.toString();
    return `${basePath}${nextQuery ? `?${nextQuery}` : ""}${hashPart}`;
}

function applyAssetCacheBusting(htmlContent, htmlFilePath) {
    const assetAttrRegex = /(\b(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi;

    return htmlContent.replace(assetAttrRegex, (fullMatch, prefix, quote, assetUrl) => {
        if (!isCacheBustedCandidate(assetUrl)) return fullMatch;

        const absoluteAssetPath = resolveAssetAbsolutePath(assetUrl, htmlFilePath);
        if (!absoluteAssetPath) return fullMatch;

        const versionHash = getFileContentHash(absoluteAssetPath);
        if (!versionHash) return fullMatch;

        const versionedUrl = withVersionQuery(assetUrl, versionHash);
        return `${prefix}${quote}${versionedUrl}${quote}`;
    });
}

function resolveHtmlFilePathFromRequestPath(requestPath) {
    const normalized = String(requestPath || "").replace(/\\/g, "/");
    const cleanPath = normalized.split("?")[0].split("#")[0];

    const candidates = [];
    if (cleanPath.toLowerCase().endsWith(".html")) {
        candidates.push(cleanPath);
    } else if (cleanPath.endsWith("/")) {
        candidates.push(`${cleanPath}index.html`);
    } else if (!path.extname(cleanPath)) {
        candidates.push(`${cleanPath}.html`);
        candidates.push(`${cleanPath}/index.html`);
    }

    for (const candidate of candidates) {
        const relativePath = candidate.replace(/^\/+/, "");
        const absolutePath = path.join(PUBLIC_DIR, relativePath);
        if (!absolutePath.startsWith(PUBLIC_DIR)) continue;
        if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
            return absolutePath;
        }
    }

    return null;
}

/* ===============================
   MIDDLEWARE
================================= */

// Parse JSON & form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Railway/Render/Proxy platforms need this for secure cookies + real client IP
app.set("trust proxy", 1);

// CORS (for separate frontend domain like Vercel)
app.use(cors(corsOptions));

// Session
app.use(session({
    proxy: isProduction,
    secret: process.env.SESSION_SECRET || "itfiesta_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: isProduction
            ? (process.env.SESSION_SAME_SITE || (allowedOrigins.length ? "none" : "lax"))
            : "lax",
        secure: isProduction
    }
}));

// Restrict direct access to admin panel page.
app.use((req, res, next) => {
    const reqPath = decodeURIComponent(req.path || "");
    const isAdminPage = reqPath === "/admin.html" || reqPath === "/admin";

    if (isAdminPage && !(req.session && req.session.isAdmin)) {
        return res.redirect("/admin-login.html");
    }

    return next();
});

// Serve HTML with automatic cache-busted asset URLs
app.use(async (req, res, next) => {
    try {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        const requestPath = decodeURIComponent(req.path || "");
        const htmlFilePath = resolveHtmlFilePathFromRequestPath(requestPath);
        if (!htmlFilePath) return next();

        const htmlContent = await fs.promises.readFile(htmlFilePath, "utf8");
        const transformedHtml = applyAssetCacheBusting(htmlContent, htmlFilePath);

        res.setHeader("Cache-Control", "no-cache");
        res.type("html");
        return res.send(transformedHtml);
    } catch (error) {
        return next();
    }
});

// Serve static files (CSS, JS, images, etc.) with long-term caching
app.use(express.static(PUBLIC_DIR, {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        const originalUrl = res.req?.originalUrl || "";
        const hasVersionHash = /[?&]v=[a-f0-9]{6,}/i.test(originalUrl);

        if (ext === ".html") {
            res.setHeader("Cache-Control", "no-cache");
            return;
        }

        if (hasVersionHash) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
            // Safety fallback for assets not yet versioned in markup/CSS.
            // Browser will revalidate, preventing stale long-term caches.
            res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
    }
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

async function removeLegacyTeamUsernameIndexes() {
   try {
      const indexes = await Team.collection.indexes();
      const legacyUsernameIndexes = indexes.filter((idx) => idx && idx.key && idx.key.username === 1);

      for (const idx of legacyUsernameIndexes) {
         await Team.collection.dropIndex(idx.name);
         console.log(`Removed legacy Team index: ${idx.name} ✅`);
      }
   } catch (err) {
      // Collection may not exist yet on fresh DB
      if (err && (err.codeName === "NamespaceNotFound" || err.code === 26)) {
         return;
      }
      console.warn("Unable to clean legacy Team indexes:", err.message || err);
   }
}

mongoose.connect(process.env.MONGO_URI)
.then(async () => {
   console.log("MongoDB Connected ✅");
   await removeLegacyTeamUsernameIndexes();
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
const adminAuth = require("./middleware/adminauth");

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body || {};
    const expectedUsername = process.env.ADMIN_USERNAME;
    const expectedPassword = process.env.ADMIN_PASSWORD;

    if (!expectedUsername || !expectedPassword) {
        return res.status(500).json({
            message: "Admin credentials are not configured on server."
        });
    }

    if (username !== expectedUsername || password !== expectedPassword) {
        return res.status(401).json({ message: "Invalid admin credentials." });
    }

    // Regenerate + explicit save to ensure cookie/session persistence on hosted platforms.
    return req.session.regenerate((regenErr) => {
        if (regenErr) {
            console.error("Admin session regenerate error:", regenErr);
            return res.status(500).json({ message: "Failed to initialize admin session." });
        }

        req.session.isAdmin = true;
        req.session.adminUser = username;

        return req.session.save((saveErr) => {
            if (saveErr) {
                console.error("Admin session save error:", saveErr);
                return res.status(500).json({ message: "Failed to persist admin session." });
            }

            return res.json({ success: true, message: "Admin login successful." });
        });
    });
});

app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        return res.json({ success: true });
    });
});

app.get("/api/admin/session", (req, res) => {
    const isAdmin = Boolean(req.session && req.session.isAdmin);
    return res.json({ isAdmin });
});

app.use("/api/admin", adminAuth, adminRoutes);

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

// Health endpoint for Railway/uptime checks
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});


/* ===============================
   DEFAULT ROUTE
================================= */

app.get("/", (req, res) => {
    res.redirect("/register.html");
});

app.get("/admin", (req, res) => {
    if (req.session && req.session.isAdmin) {
        return res.redirect("/admin.html");
    }
    return res.redirect("/admin-login.html");
});

/* ===============================
   SERVER START
================================= */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
