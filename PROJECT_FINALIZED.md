# IT Fiesta Project (Finalized)

## 1) Project Concept
This project is a full-stack event platform for **IT Fiesta**, supporting two competition tracks:

- **Tech Escape Room** (multi-level quiz/challenge flow)
- **Black Box Challenge** (round-based logic/problem solving)

It includes participant registration/login, game progression APIs, admin controls, and public leaderboard support.

---

## 2) Project Aim
The aim of this project is to:

- Manage participant onboarding (registration/login)
- Run technical event rounds/levels with scoring and anti-cheat logic
- Provide admin controls for event/batch management
- Display leaderboard rankings fairly and in near real-time
- Serve frontend assets efficiently with cache-safe behavior for production

---

## 3) Final Project Structure
After cleanup, only active project folders/files are kept.

```text
IT(Feistaa) new/
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── server.js
├── LEADERBOARD_GUIDE.md
├── LEADERBOARD_QUICK_START.md
├── middleware/
│   └── adminauth.js
├── models/
│   ├── BatchControl.js
│   ├── EscapeQuestion.js
│   ├── Event.js
│   ├── Settings.js
│   └── Team.js
├── routes/
│   ├── admin.js
│   ├── auth.js
│   ├── blackbox.js
│   ├── escape.js
│   └── events.js
├── scripts/
│   ├── seed-escape.js
│   └── seedBlackboxQuestions.js
└── public/
    ├── register.html
    ├── login.html
    ├── leaderboard.html
    ├── admin.html
    ├── css/
    ├── js/
    ├── blackbox/
    └── escape/
```

---

## 4) Removed Unwanted Folders
The following backup/duplicate folders were removed as requested:

- `blackbox old folder/`
- `replace/`

---

## 5) How to Run the Project

### Prerequisites
- Node.js (LTS recommended)
- MongoDB connection string

### Setup
1. Open terminal in project root:
   ```bash
   c:\IT(Feistaa) new
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment file `.env` with at least:
   ```env
   MONGO_URI=your_mongodb_connection_string
   ```

### Start Server
```bash
node server.js
```

Server runs at:
- `http://localhost:3000`

Default root behavior redirects to:
- `/register.html`

---

## 6) Notes
- Static asset cache-busting is active in `server.js` using content-hash version query parameters for reliable browser refresh on file changes.
- HTML is served with no-cache behavior, and versioned assets are safe for long-term caching.
