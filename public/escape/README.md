# IT Fiesta Escape Room - Complete Setup Guide

## 📋 Overview
A mobile-friendly 3-level escape room game for college tech events using MongoDB Atlas and Node.js backend.

---

## 🏗️ Architecture
- **Frontend:** HTML, CSS, plain JavaScript (no frameworks)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas (cloud)
- **Hosting Options:** Vercel (backend), Netlify (frontend), or self-hosted

---

## 🚀 Quick Start

### 1️⃣ MongoDB Atlas Setup
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free account and cluster
3. Create a database user (e.g., `itfiesta_user`)
4. Get your connection string: `mongodb+srv://user:pass@cluster.mongodb.net/itfiesta?retryWrites=true&w=majority`
5. Whitelist your IP (or 0.0.0.0 for testing)

### 2️⃣ Backend Setup
```bash
cd backend
npm install
```

Create `.env` file in `backend/` folder:
```
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/itfiesta?retryWrites=true&w=majority
PORT=5000
```

Start the backend:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

Seed sample questions:
```bash
curl -X POST http://localhost:5000/api/seed-questions
```

### 3️⃣ Frontend Setup
Serve the frontend files (open with Live Server or use Python):
```bash
cd c:\itfiesta-escape-room
python -m http.server 8000
```

Open `http://localhost:8000` in your browser.

---

## 📱 Testing Flow

1. **Admin Dashboard:** `http://localhost:8000/admin/admin.html`
   - Register teams
   - View real-time scores
   - Eliminate teams

2. **Player Landing:** `http://localhost:8000/`
   - Read instructions
   - Click to start Level 1

3. **Play Level 1:**
   - Answer 6 MCQ questions in 6 minutes
   - Click Next → Submit
   - Redirected to waiting page

4. **Admin Eliminates Lowest Teams**
   - Use admin dashboard to eliminate teams
   - Remaining teams can proceed to Level 2

5. **Repeat for Levels 2 & 3**

---

## 🔐 Security & Fairness

✅ **Tab Switching Detection:**
- Switching browser tabs redirects to elimination page
- Works on most modern browsers

✅ **Navigation Guards:**
- Back button redirects to elimination
- No direct URL jumping allowed

✅ **Timer Enforcement:**
- Server-based timers
- Inputs freeze when time expires
- Scores calculated on timeout

✅ **One Device Per Team:**
- Use `teamId` to lock one device per team
- TeamId stored in `sessionStorage`

---

## 📡 API Endpoints

### Questions
- `GET /api/questions/:level` - Fetch questions for a level

### Teams
- `POST /api/teams/register` - Register a new team
- `GET /api/teams` - Get all teams (admin)
- `GET /api/teams/:teamId` - Get single team
- `POST /api/teams/:teamId/submit` - Submit score for a level
- `POST /api/teams/:teamId/eliminate` - Mark team as eliminated

### Admin
- `POST /api/seed-questions` - Seed sample questions

---

## 🎨 Customization

### Update Questions
Edit `backend/server.js` in the seed endpoint or add questions via admin panel.

### Change Timers
- **Level 1:** `360` seconds (6 min) in `levels/level1.js`
- **Level 2:** `300` seconds (5 min) in `levels/level2.js`
- **Level 3:** `180` seconds (3 min) in `levels/level3.js`

### Update Colors/Theme
Edit `assets/css/style.css` `:root` variables

---

## 🚀 Production Deployment

### Option A: Deploy on Vercel (Recommended)
```bash
# Backend on Vercel
npm install -g vercel
cd backend
vercel

# Frontend on Netlify
netlify deploy --prod --dir=.
```

### Option B: Self-Hosted (VPS/Heroku)
```bash
# Heroku example
cd backend
heroku create your-app-name
git push heroku main
```

Set `API_BASE_URL` in `assets/js/api.js` to your deployed backend URL.

---

## 🐛 Troubleshooting

**Questions not loading:**
- Check backend is running: `http://localhost:5000/api/questions/level1`
- Check MongoDB connection in `.env`
- Run seed endpoint: `curl -X POST http://localhost:5000/api/seed-questions`

**Scores not submitting:**
- Open DevTools Console, check for fetch errors
- Ensure backend and frontend on same network (or CORS enabled)

**Timer not counting:**
- Clear browser cache (Ctrl+Shift+Delete)
- Refresh page

**Tab switch not eliminating:**
- Use Chrome/Edge (Safari has limitations with `visibilitychange`)
- Test on actual device, not browser DevTools emulator

---

## 📞 Support
For issues, check:
1. Backend console logs
2. Browser DevTools Console
3. MongoDB Atlas logs
4. Ensure `.env` has correct MongoDB URI

---

## 📝 License
© 2026 IT Fiesta. All rights reserved.
