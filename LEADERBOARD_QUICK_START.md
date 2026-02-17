# 🎯 Quick Reference - Live Leaderboard System

## 🌐 URLs

### Public Pages
- **Leaderboard:** `http://localhost:3000/leaderboard.html`
- **Register:** `http://localhost:3000/register.html`
- **Login:** `http://localhost:3000/login.html`

### Admin Pages
- **Admin Panel:** `http://localhost:3000/admin.html`

---

## 🎮 How to Use

### For Public/Audience:

1. **Visit:** `http://localhost:3000/leaderboard.html`
2. **Switch Events:** Click "🧩 Escape Room" or "📦 Black Box"
3. **Toggle Batches:** Click "🔄 Mixed Batches" to see all batches
4. **Watch Live:** Page auto-refreshes every 5 seconds

---

### For Admins:

1. **Open Admin Panel:** `http://localhost:3000/admin.html`
2. **Scroll to:** "🏆 Public Leaderboard Control" section
3. **Enable/Disable:** Click buttons to control public visibility
4. **View Public Page:** Click "👁️ View Public Page" to see live board

---

## 🏆 Ranking System

**Teams ranked by:**
1. **Total Score** = Score - Penalty ⬆️ (Higher is better)
2. **If tied** → Time ⬇️ (Faster is better)

**Example:**
```
Rank 1: Team A → Score: 100, Time: 5:30
Rank 2: Team B → Score: 100, Time: 6:00
Rank 3: Team C → Score: 95,  Time: 4:00
```

---

## 🎨 Visual Features

### Medals & Badges:
- 🥇 **1st Place** - Gold medal
- 🥈 **2nd Place** - Silver medal  
- 🥉 **3rd Place** - Bronze medal
- **Score** - Green badge
- **Time** - Blue badge
- **Batch** - Purple badge
- **Status** - Color-coded (green/blue)

### UI Theme:
- Dark nebula background
- Star field effect
- Glass morphism cards
- Smooth animations
- Mobile responsive

---

## 📊 Data Display

### Leaderboard Columns:
| Column | Shows |
|--------|-------|
| Rank | Position (1, 2, 3...) |
| Team Name | Team display name |
| Score | Total Score (Score - Penalty) |
| Time | Total exam time (MM:SS) |
| Batch | Batch number |
| Status | Completed / In Progress |

---

## 🔧 Admin Controls

### Leaderboard Toggle:
- **✅ Enable** → Public can view rankings
- **❌ Disable** → Public page shows empty
- **👁️ View** → Opens public page in new tab
- **Status** → Shows current state (updates every 5s)

### Use Cases:
- **Enable** during event for live viewing
- **Disable** during batch transitions or breaks
- **Enable** again for finals/results

---

## ⚡ Live Features

### Auto-Refresh:
- Updates every **5 seconds**
- No page reload needed
- Shows live indicator (🔴 LIVE)
- Real-time ranking changes

### Filtering:
- **Event Filter** - Escape / Black Box
- **Batch Filter** - Current batch / All batches
- Instant switching (no lag)

---

## 💡 Pro Tips

1. **During Event:**
   - Keep leaderboard enabled
   - Use "Current Batch" mode
   - Display on projector/screen

2. **Between Batches:**
   - Optionally disable
   - Prepare next teams
   - Re-enable when ready

3. **Final Results:**
   - Enable "Mixed Batches"
   - Shows all-time rankings
   - Perfect for winner announcement

4. **Mobile Viewing:**
   - Fully responsive
   - Works on phones/tablets
   - Participants can track progress

---

## 🚨 Common Questions

**Q: Why is leaderboard empty?**
- Check if enabled in admin panel
- Verify teams have started (status: active/completed)
- Ensure teams assigned to current batch

**Q: How to show all batches?**
- Click "🔄 Mixed Batches" button
- Button turns active when enabled

**Q: Can participants see live rankings?**
- Yes! Share `http://localhost:3000/leaderboard.html`
- Auto-updates every 5 seconds
- No login required

**Q: How to hide leaderboard temporarily?**
- Admin panel → Click "❌ Disable Leaderboard"
- Public page will show empty data
- Re-enable anytime

---

## ✅ Testing Steps

1. ✅ Start server: `node server.js`
2. ✅ Open admin: `http://localhost:3000/admin.html`
3. ✅ Check leaderboard section (scroll down)
4. ✅ Click "Enable Leaderboard"
5. ✅ Click "View Public Page"
6. ✅ Test event switch (Escape ↔ Black Box)
7. ✅ Test batch toggle (Current ↔ Mixed)
8. ✅ Watch auto-refresh (wait 5 seconds)

---

## 🎉 You're All Set!

The live leaderboard system is fully operational with:
- ✅ Real-time updates
- ✅ Admin control
- ✅ Event filtering
- ✅ Batch management
- ✅ Beautiful UI
- ✅ Mobile responsive

**Share the leaderboard URL with participants and enjoy the competition!** 🏆
