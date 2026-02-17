# IT Fiesta Escape Room - Complete Setup Guide

## ✅ System Status: READY FOR TESTING

### 🎯 Current Configuration

**Frontend:**
- URL: `http://localhost:8000`
- Server: Python HTTP (port 8000)

**Backend:**
- URL: `http://localhost:5000`
- Server: Node.js + Express
- Database: Auto-fallback to Sample DB on MongoDB connection failure
- MongoDB: Set in `.env` (MONGO_URI)

---

## 📋 Test Flow

### **User Path:**
```
1. Home Page (http://localhost:8000)
   ↓
2. View Instructions → Click "Start Testing"
   ↓
3. Auto-populates team + seeds questions
   ↓
4. Level 1 (6 questions, 3 minutes)
   - Randomized questions
   - Shuffled answer options
   - NO Previous button (one-way only)
   - Answer required before Next
   ↓
5. Submit → Waiting Page
   (NOT eliminated - waits for admin)
   ↓
6. Admin Decision (from Admin Panel)
   - Advance → Level 2
   - Eliminate → Eliminated Page
   ↓
7. Level 2, 3, 4 (same pattern, different durations)
```

---

## ⚙️ Configuration Details

### **Level Times:**
- **Level 1**: 3 minutes (180 sec) - 6 questions
- **Level 2**: 5 minutes (300 sec) - 10 questions
- **Level 3**: 5 minutes (300 sec) - 5 questions
- **Level 4**: 5 minutes (300 sec) - 8 questions

### **Answer Scoring:**
- Each correct answer: **10 marks** (configurable per question)
- Total score = sum of marks for correct answers
- Submitted to database on Level Complete

### **Anti-Cheat Features:**
- ✅ Tab switch detection → Immediate elimination
- ✅ Full-screen enforcement → Auto-request
- ✅ Full-screen exit detection → Eliminate (except after submission)
- ✅ Back navigation lock → Redirect to eliminated
- ✅ Unload warning → Prevents accidental tab close

### **Question Management:**
- Questions stored in MongoDB (with auto-fallback to Sample DB)
- 27 total questions available (6-10 per level)
- Randomized per exam session
- Options shuffled per question load

---

## 👨‍💼 Admin Control Panel

**URL:** `http://localhost:8000/admin/control.html`

**Features:**
- 📊 Real-time team dashboard
- 👥 View all teams with scores
- ➡️ **Advance** button: Move team to next level
- ❌ **Eliminate** button: Remove team from game
- 🔄 Auto-refresh every 5 seconds
- 📈 Stats: Total teams, active, waiting, eliminated

**How to Use:**
1. Open Admin Panel in separate browser tab
2. Teams appear on waiting page after Level submission
3. Review scores in Admin Panel
4. Click Advance/Eliminate
5. Team redirected automatically

---

## 🔧 Key Fixes Applied

### **1. Elimination Issue (FIXED)**
**Problem:** User redirected to eliminated page after submission
**Solution:** 
- Added `EXAM_SUBMITTED` flag to disable anti-cheat after submission
- Full-screen exit detection now checks this flag before eliminating
- Tab-switch detection now respects the flag

### **2. Previous Button (FIXED)**
**Problem:** Users could go back to previous questions
**Solution:**
- Previous button hidden and disabled on all levels
- Questions are one-way progression only
- Once answer submitted, cannot revisit

### **3. Time Limit (FIXED)**
**Problem:** Level 1 was 6 minutes
**Solution:**
- Changed Level 1 to **3 minutes (180 seconds)**
- Updated timer logic
- Other levels remain: L2/L3/L4 = 5 minutes each

### **4. Database (SEMI-FIXED)**
**Problem:** MongoDB IP whitelisting issue
**Solution:**
- Backend tries MongoDB connection (3 sec timeout)
- Auto-fallback to Sample DB if connection fails
- **ACTION NEEDED:** Admin must whitelist IP in MongoDB Atlas

---

## 📌 MongoDB Setup (For Admin)

Your current MongoDB URI: `mongodb+srv://kaushick_db_user:rolex2005@cluster0.5aujr6c.mongodb.net/itfiesta`

**To fix IP whitelisting:**
1. Go to MongoDB Atlas Console
2. Navigate to: **Security** → **Network Access**
3. Click **"Add IP Address"**
4. Add your current IP (or 0.0.0.0/0 for all)
5. Confirm

Once whitelist is updated, backend will connect automatically on restart.

---

## 🚀 Testing Checklist

- [ ] **Start Testing** button works
- [ ] Questions load for Level 1
- [ ] Options are randomized/shuffled
- [ ] Previous button is hidden
- [ ] Timer shows 3:00 for Level 1
- [ ] Can answer and click Next
- [ ] Submit button appears on Q6
- [ ] Redirects to Waiting Page (NOT eliminated)
- [ ] Waiting page shows team info
- [ ] Admin Panel shows team
- [ ] Admin can click Advance
- [ ] Team automatically advances to Level 2
- [ ] Tab switch during level = elimination
- [ ] Tab switch during waiting = no effect

---

## 📊 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/seed-questions` | POST | Seed all questions to database |
| `/api/questions/:level` | GET | Fetch questions for a level |
| `/api/teams/register` | POST | Register a new team |
| `/api/teams/login` | POST | Team login |
| `/api/teams/:teamId/submit` | POST | Submit score for a level |
| `/api/teams/:teamId/advance` | POST | Admin: Advance team to next level |
| `/api/teams/:teamId/eliminate` | POST | Admin: Eliminate team |
| `/api/teams` | GET | Get all teams |
| `/api/teams/:teamId` | GET | Get single team details |

---

## 🛠️ Environment Variables (.env)

```
MONGO_URI=mongodb+srv://kaushick_db_user:rolex2005@cluster0.5aujr6c.mongodb.net/itfiesta?retryWrites=true&w=majority
PORT=5000
USE_SAMPLE_DB=false    # Set to "true" to force Sample DB mode
```

---

## 📞 Troubleshooting

**Backend not responding:**
```powershell
# Restart backend
taskkill /F /IM node.exe
cd c:\itfiesta-escape-room\backend
npm start
```

**Questions not loading:**
- Wait 5 seconds for sample DB to seed
- Check browser console (F12) for errors
- Verify API endpoint: `http://localhost:5000/api/questions/1`

**Waiting page shows "No team":**
- Ensure sessionStorage is not cleared
- Open browser DevTools → Application → SessionStorage
- Should show: `teamId`, `teamName`, `currentLevel`

**Admin Panel not showing teams:**
- Refresh page (F5)
- Check that team submitted first
- Open Admin Panel after team submits

---

## 📝 Next Steps (Admin Provision)

1. **Get your IP whitelisted** on MongoDB Atlas
2. **Share MongoDB URI** if different from current
3. **Update .env** with correct connection string
4. **Test flow** using checklist above
5. **Run real exam** with students

---

**Version:** 2.0 - Ready for Production Testing
**Last Updated:** February 13, 2026
