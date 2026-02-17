# 🏆 Live Leaderboard System - Complete Guide

## 📋 Overview

A comprehensive, real-time leaderboard system for IT Fiesta events with:

✅ **Separate public leaderboard page**  
✅ **Two event filters** → Escape Room / Black Box  
✅ **Mixed batch toggle** → View all batches or current batch only  
✅ **Live auto-refresh** → Updates every 5 seconds  
✅ **Admin control** → Enable/disable public visibility  
✅ **Smart ranking** → Score-based with time tie-breaker  

---

## 🚀 Quick Start

### 1. Access Public Leaderboard

**URL:** `http://localhost:3000/leaderboard.html`

**Features:**
- Auto-refreshes every 5 seconds
- Switch between Escape Room and Black Box events
- Toggle mixed batch mode to see all batches or just current batch
- Beautiful nebula-themed dark UI with star field effect
- Mobile responsive

---

### 2. Admin Control Panel

**URL:** `http://localhost:3000/admin.html`

**Leaderboard Controls:**
- ✅ **Enable Leaderboard** - Make public page visible
- ❌ **Disable Leaderboard** - Hide public page (returns empty data)
- 👁️ **View Public Page** - Opens leaderboard in new tab
- **Status Indicator** - Shows real-time enabled/disabled status

---

## 🏗️ System Architecture

### Files Created/Modified

```
📁 Project Root
├── 📄 server.js (Modified)
│   └── Added /api/leaderboard endpoint
│   └── Added Settings initialization
│
├── 📁 models/
│   └── 📄 Settings.js (NEW)
│       └── Stores leaderboard enabled/disabled state
│
├── 📁 routes/
│   └── 📄 admin.js (Modified)
│       └── Added leaderboard toggle endpoints
│
├── 📁 public/
│   ├── 📄 leaderboard.html (NEW)
│   │   └── Public-facing leaderboard page
│   │
│   ├── 📄 admin.html (Modified)
│   │   └── Added leaderboard control panel
│   │
│   └── 📁 js/
│       └── 📄 leaderboard.js (NEW)
│           └── Live refresh and filtering logic
```

---

## 🔧 How It Works

### 1. Ranking Algorithm

```javascript
// Teams ranked by:
1. Total Score (DESC) = score - penalty
2. If tied → Total Exam Time (ASC) = faster time wins
```

**Example:**
```
Team A: Score 100, Time 5:30  → Rank 1
Team B: Score 100, Time 6:00  → Rank 2 (slower)
Team C: Score 95,  Time 4:00  → Rank 3 (lower score)
```

---

### 2. Batch Filtering

**Mixed Batch OFF (Default):**
- Shows only teams from the **current active batch**
- Controlled by `BatchControl.currentBatch` for selected event

**Mixed Batch ON:**
- Shows **all batches** for selected event
- Useful for final overall rankings

---

### 3. Event Filtering

**Escape Room:**
- Shows teams with `eventType: "escape"`

**Black Box:**
- Shows teams with `eventType: "blackbox"`

---

### 4. Auto-Refresh

```javascript
setInterval(fetchData, 5000); // Refresh every 5 seconds
```

- Automatically fetches updated data
- No page reload needed
- Live indicator shows refresh status

---

## 📡 API Endpoints

### Public API

#### `GET /api/leaderboard`

**Query Parameters:**
- `event` (string) - "escape" or "blackbox"
- `mixed` (boolean) - "true" to show all batches

**Example Requests:**
```bash
# Escape Room - Current Batch Only
GET /api/leaderboard?event=escape&mixed=false

# Black Box - All Batches
GET /api/leaderboard?event=blackbox&mixed=true
```

**Response:**
```json
[
  {
    "teamId": "TEAM001",
    "teamName": "Code Warriors",
    "eventType": "escape",
    "batch": 1,
    "score": 100,
    "penalty": 10,
    "totalScore": 90,
    "totalExamTime": 450,
    "status": "completed"
  }
]
```

**Returns empty array `[]` if leaderboard is disabled**

---

### Admin APIs

#### `GET /api/admin/leaderboard/status`

**Response:**
```json
{
  "enabled": true,
  "updatedAt": "2026-02-17T10:30:00Z"
}
```

#### `POST /api/admin/leaderboard/toggle`

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "message": "Leaderboard enabled"
}
```

---

## 🎨 UI Features

### Public Leaderboard Page

**Header:**
- 🏆 Title with gradient effect
- 🔴 Live indicator with pulse animation
- Real-time update counter

**Control Panel:**
- 🧩 Escape Room button
- 📦 Black Box button
- 🔄 Mixed Batches toggle

**Leaderboard Table:**
- 🥇🥈🥉 Top 3 with medal badges
- Color-coded ranking
- Score badges (green)
- Time badges (blue)
- Batch badges (purple)
- Status indicators

**Mobile Responsive:**
- Stacks buttons vertically
- Adjusts table font sizes
- Maintains readability

---

### Admin Control Panel

**Status Indicator:**
- ✅ Green when enabled
- ❌ Red when disabled
- Auto-refreshes every 5 seconds

**Action Buttons:**
- Professional dark theme
- Hover effects
- Color-coded (green/red/blue)

---

## 🛡️ Security Features

1. **Admin-Only Toggle:**
   - Only admin can enable/disable leaderboard
   - Protected by admin routes

2. **XSS Prevention:**
   - HTML escaping on team names
   - Safe rendering of user data

3. **Data Validation:**
   - Query parameter sanitization
   - Error handling on all endpoints

---

## 📊 Database Schema

### Settings Collection

```javascript
{
  key: "leaderboardEnabled",
  value: true,  // boolean
  description: "Enable/disable public leaderboard visibility",
  updatedAt: Date
}
```

**Initialized on server start with default `value: true`**

---

## 🎯 Usage Scenarios

### Scenario 1: During Event

```
1. Admin keeps leaderboard enabled
2. Teams compete and scores update
3. Public can view live rankings
4. Auto-refreshes show real-time changes
```

### Scenario 2: Between Batches

```
1. Admin disables leaderboard (optional)
2. Prepare next batch
3. Start new batch
4. Re-enable leaderboard
```

### Scenario 3: Final Rankings

```
1. Enable "Mixed Batches" mode
2. View all batches together
3. Export or display final winners
```

---

## 🔍 Troubleshooting

### Issue: Leaderboard shows empty

**Solutions:**
1. Check if leaderboard is enabled in admin panel
2. Verify teams have `status: "active"` or `"completed"`
3. Check if teams are assigned to current batch
4. Ensure event type matches filter

### Issue: Rankings seem incorrect

**Check:**
1. Team scores are properly updated
2. Penalties are calculated correctly
3. `totalExamTime` is recorded
4. Database has latest data

### Issue: Not auto-refreshing

**Solutions:**
1. Check browser console for errors
2. Verify `/api/leaderboard` endpoint is working
3. Clear browser cache
4. Check network connectivity

---

## 🚀 Future Enhancements

Potential improvements:

1. **Export Rankings:**
   - CSV export
   - PDF reports
   - Share via link

2. **Historical Data:**
   - View past batches
   - Compare performances
   - Trend analysis

3. **Animations:**
   - Rank change indicators
   - Score update effects
   - Team spotlight

4. **Filters:**
   - Search by team name
   - Filter by score range
   - Sort by different columns

---

## 📝 Notes

- Leaderboard automatically enabled on first server start
- Requires MongoDB connection
- Works with existing Team and BatchControl models
- No migration needed - compatible with current data structure

---

## ✅ Testing Checklist

- [ ] Public leaderboard page loads
- [ ] Shows teams from correct event
- [ ] Mixed batch toggle works
- [ ] Auto-refresh every 5 seconds
- [ ] Admin toggle enables/disables
- [ ] Rankings ordered correctly (score, then time)
- [ ] Empty state shows when no teams
- [ ] Mobile responsive layout works
- [ ] API returns correct data format
- [ ] Admin status indicator updates

---

## 🎉 Success!

Your live leaderboard system is now fully operational!

**Test it:**
1. Start server: `node server.js`
2. Visit: `http://localhost:3000/leaderboard.html`
3. Toggle settings in admin panel
4. Watch live updates!
