# Production Deployment Guide (Vercel + Render)

This guide is for your stack:

- **Frontend:** HTML/CSS/JavaScript (static pages)
- **Backend:** Node.js + Express
- **Database:** MongoDB (Atlas)

Goal:

- Deploy **Backend on Render (Free)**
- Deploy **Frontend on Vercel (Free)**
- Connect both correctly for production

---

## 1) Prepare backend for deployment

Before deploying to Render, make sure backend has:

1. A valid `package.json` with dependencies.
2. A start command (either script or direct command).
3. Server listening on Render port:

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
```

4. DB connection from env variable (not hardcoded):

```js
mongoose.connect(process.env.MONGO_URI)
```

5. Secrets from env variables:
   - `MONGO_URI`
   - `SESSION_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NODE_ENV=production`

6. (Recommended) Add health route:

```js
app.get('/health', (req, res) => res.status(200).send('OK'));
```

---

## 2) Deploy backend on Render

1. Go to **Render Dashboard** → **New +** → **Web Service**.
2. Connect your backend GitHub repository.
3. Fill Render form:

| Field | Value |
|---|---|
| Name | `your-backend-name` |
| Language | `Node` |
| Branch | `main` (or your deployment branch) |
| Root Directory | backend folder name (leave blank if backend is repo root) |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | `Free` |

> If your backend uses another entry file, replace `server.js` accordingly.

4. Click **Deploy Web Service**.

---

## 3) Add environment variables on Render

In Render service → **Environment** tab, add:

```env
MONGO_URI=your_mongodb_atlas_connection_string
SESSION_SECRET=your_long_random_secret
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
NODE_ENV=production
```

Then:

1. Save changes
2. Trigger **Manual Deploy** (if not auto-triggered)

---

## 4) Get backend URL

After successful deploy, Render gives URL like:

```text
https://your-backend-name.onrender.com
```

Test quickly:

- `https://your-backend-name.onrender.com/health`
- Or any known API route like `/api/events`

If it returns expected response, backend is live.

---

## 5) Deploy frontend on Vercel

1. Go to **Vercel Dashboard** → **Add New** → **Project**.
2. Import frontend GitHub repository.
3. Configure:
   - Framework Preset:
     - **Other** for plain HTML/CSS/JS
     - **React** if React app
   - Root Directory:
     - Set frontend folder if monorepo/separate folder
4. Build settings:
   - Plain static frontend: no build command needed
   - React/Vite: keep defaults (`npm run build`, output `dist`)
5. Click **Deploy**.

Vercel provides URL like:

```text
https://your-frontend.vercel.app
```

---

## 6) Connect frontend to deployed backend

Update frontend API base URL to Render URL.

Example for plain JS:

```js
const API_BASE_URL = 'https://your-backend-name.onrender.com';

fetch(`${API_BASE_URL}/api/events`)
```

If React/Vite, use env variable in frontend:

```env
VITE_API_BASE_URL=https://your-backend-name.onrender.com
```

Then use in code:

```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

Redeploy frontend after changing API URL.

---

## 7) Enable CORS correctly (important)

Since frontend (Vercel) and backend (Render) are different domains, enable CORS in Express.

Install:

```bash
npm install cors
```

Backend setup:

```js
const cors = require('cors');

app.use(cors({
  origin: [
    'https://your-frontend.vercel.app'
  ],
  credentials: true
}));
```

If using cookies/sessions cross-origin:

- Frontend fetch must send credentials:

```js
fetch(url, { credentials: 'include' })
```

- Session cookie config should be production-safe:

```js
cookie: {
  httpOnly: true,
  secure: true,
  sameSite: 'none'
}
```

> For same-site deployments only, `sameSite: 'lax'` can work. For Vercel ↔ Render cross-site cookie auth, use `sameSite: 'none'` + `secure: true`.

---

## 8) Common errors + fixes

### Error: `Application failed to respond`
- Wrong start command or app not listening to `process.env.PORT`.
- Fix start command and port usage.

### Error: MongoDB connection failure
- Wrong `MONGO_URI` or Atlas network restrictions.
- In Atlas, allow Render access (or temporary `0.0.0.0/0` while testing).

### Error: CORS blocked in browser
- Backend CORS origin not matching exact Vercel URL.
- Add exact frontend domain in CORS config.

### Error: 404 on API from frontend
- Wrong API base URL or wrong route path.
- Verify final URL in browser/network tab.

### Error: Session/login not persisting
- Missing credentials in fetch or cookie settings not set for cross-origin.
- Use `credentials: 'include'`, `sameSite: 'none'`, `secure: true`.

### Error: Vercel page works locally but not in production
- Environment variable not set in Vercel dashboard.
- Add env var in Vercel → Settings → Environment Variables and redeploy.

---

## 9) Final launch checklist

- [ ] Backend Render service is **Live**
- [ ] Backend health/API routes respond correctly
- [ ] Render env vars are set (`MONGO_URI`, secrets, etc.)
- [ ] MongoDB Atlas allows backend connection
- [ ] Frontend deployed on Vercel successfully
- [ ] Frontend uses production backend URL
- [ ] CORS allows only your Vercel domain
- [ ] Login/session flow works in production
- [ ] Admin route works (`/admin`)
- [ ] Basic security done (strong secrets, no hardcoded credentials)

---

## Optional: Quick go-live order

1. Deploy backend on Render
2. Confirm backend API works
3. Deploy frontend on Vercel
4. Update frontend API URL
5. Test full flow (register/login/game/admin)
6. Share final URLs with team
