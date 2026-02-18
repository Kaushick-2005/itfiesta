# Railway Deployment Setup (IT Fiesta)

This project is now prepared for Railway deployment.

## What was already fixed in code

- Added `start` script in `package.json` (`node server.js`)
- Added production-safe middleware in `server.js`:
  - `trust proxy`
  - `cors`
  - `/health` route
  - production cookie handling
- Added `cors` dependency
- Updated frontend API calls in key public pages (`register`, `login`, `leaderboard`, admin login) to support external backend URL

---

## 1) Push latest code to GitHub

```bash
git add .
git commit -m "Prepare app for Railway deployment"
git push origin main
```

---

## 2) Deploy backend on Railway

1. Open Railway dashboard: https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. Select your repo (`itfiesta`)
4. Railway auto-detects Node app
5. Ensure service uses:
   - Build: `npm install`
   - Start: `npm start` (or `node server.js`)

---

## 3) Add Environment Variables in Railway

In Railway service → **Variables**, add:

```env
MONGO_URI=<your_mongodb_connection_string>
SESSION_SECRET=<long_random_secret>
ADMIN_USERNAME=<your_admin_username>
ADMIN_PASSWORD=<your_admin_password>
NODE_ENV=production
```

## ✅ Exact ENV keys (copy these names exactly)

Use these **exact variable names** in Railway:

```env
MONGO_URI=
SESSION_SECRET=
ADMIN_USERNAME=
ADMIN_PASSWORD=
NODE_ENV=production
CORS_ORIGIN=
SESSION_SAME_SITE=
```

### Recommended exact values by setup

### A) If frontend + backend both run on Railway same domain

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
SESSION_SECRET=itfiesta_2026_super_long_random_secret_change_this
ADMIN_USERNAME=itfiesta_admin
ADMIN_PASSWORD=Fiesta@2026#Secure
NODE_ENV=production
# Optional in same-domain mode:
CORS_ORIGIN=
SESSION_SAME_SITE=lax
```

### B) If frontend is separate (Vercel) and backend is Railway

```env
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority
SESSION_SECRET=itfiesta_2026_super_long_random_secret_change_this
ADMIN_USERNAME=itfiesta_admin
ADMIN_PASSWORD=Fiesta@2026#Secure
NODE_ENV=production
CORS_ORIGIN=https://<your-frontend>.vercel.app
SESSION_SAME_SITE=none
```

> If you have multiple frontend domains, use comma-separated values in `CORS_ORIGIN`:
> `https://a.vercel.app,https://b.vercel.app`

### If frontend is hosted separately (Vercel/Netlify), also add:

```env
CORS_ORIGIN=https://your-frontend-domain.vercel.app
SESSION_SAME_SITE=none
```

> For multiple frontend domains, comma-separate in `CORS_ORIGIN`:
> `https://a.vercel.app,https://b.vercel.app`

---

## 4) Get Railway public URL

1. Open service → **Settings / Networking**
2. Generate public domain if not already generated
3. You’ll get URL like:

```text
https://your-service-name.up.railway.app
```

4. Test:

- `https://your-service-name.up.railway.app/health`
- `https://your-service-name.up.railway.app/api/events/active`

---

## 5) Frontend connection options

## Option A (Simple): Host full app on Railway only

- Keep frontend + backend in same service/domain
- No extra frontend API base config needed

## Option B: Frontend on Vercel, backend on Railway

Set global API base URL in frontend (before other app scripts):

```html
<script>
  window.__API_BASE_URL = "https://itfiesta.up.railway.app";
</script>
```

And keep Railway env:

- `CORS_ORIGIN=https://your-frontend-domain.vercel.app`
- `SESSION_SAME_SITE=none`

---

## 6) Final pre-launch checklist

- [ ] Railway deploy is successful (status healthy)
- [ ] `/health` returns `{ "status": "ok" }`
- [ ] MongoDB connected (check logs)
- [ ] Admin login works at `/admin`
- [ ] Registration + login flows work
- [ ] Leaderboard loads correctly
- [ ] If separate frontend used, CORS is configured with exact frontend domain

---

## 7) Quick troubleshooting

### App crashes on deploy
- Check Railway logs for missing env vars (`MONGO_URI`, etc.)

### API blocked by CORS
- Set `CORS_ORIGIN` exactly to frontend origin (with `https://`)

### Login/session not persisting cross-domain
- Set `SESSION_SAME_SITE=none`
- Keep `NODE_ENV=production`
- Use HTTPS frontend domain

### DB not connecting
- Verify `MONGO_URI`
- In Atlas, allow network access for Railway egress (or temporary `0.0.0.0/0` for testing)







Perfect, now we found the real issue ✅

Your app log says it is listening on:
- `Server running at http://localhost:8080`

But your Railway domain (from screenshot) is mapped to:
- **Port 3000**

So this is a **port mismatch**: Railway is forwarding traffic to 3000, while app is on 8080 → “Application failed to respond”.

### Fix (2-minute)
1. Railway → Service → **Settings** → **Networking**
2. Edit public domain target port from **3000** to **8080**
3. Save
4. Restart/redeploy once
5. Test again: `https://itfiesta.up.railway.app/health`

### Alternative fix (if you want to keep 3000)
Set Railway env var:
- `PORT=3000`
Then redeploy.

---
I recommend the first option (set networking to 8080) because your app is already running there.

If you apply that and still get failure, send one screenshot of **Networking port** + **latest deploy logs** and I’ll pinpoint the next step immediately.


https://itfiesta.up.railway.app/admin-login.html


- username = `itfiesta_admin`

- password = `Fiesta@2026`
