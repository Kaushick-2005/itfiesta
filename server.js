const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
require("dotenv").config();

const app = express();

/* ===============================
   MIDDLEWARE
================================= */

// Parse JSON & form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static("public"));

// Session (you can keep for now)
app.use(session({
    secret: "itfiesta_secret_key",
    resave: false,
    saveUninitialized: true
}));

/* ===============================
   DATABASE CONNECTION
================================= */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
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
