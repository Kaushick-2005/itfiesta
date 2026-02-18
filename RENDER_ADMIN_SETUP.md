# Render Deployment + Admin Access Setup (Exact Steps)

Follow these steps to host the website on Render and give restricted admin access to another person.

---

## 1) Push latest code to GitHub

1. Open terminal in project folder.
2. Commit and push:

```bash
git add .
git commit -m "Add secure admin login for Render"
git push origin main
```

---

## 2) Create Web Service on Render

1. Go to: https://dashboard.render.com
2. Click **New +** → **Web Service**.
3. Connect your GitHub repo.
4. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

---

## 3) Add Environment Variables in Render

Go to **Your Service → Environment** and add these:

```env
MONGO_URI=<your_mongodb_connection_string>
SESSION_SECRET=<long_random_secret_string>
ADMIN_USERNAME=<your_admin_username>
ADMIN_PASSWORD=<your_admin_password>
NODE_ENV=production
```

### Example (replace with your own values)

```env
ADMIN_USERNAME=itfiesta_admin
ADMIN_PASSWORD=Fiesta@2026#Secure
```

> Whatever you set for `ADMIN_USERNAME` and `ADMIN_PASSWORD` becomes the actual admin login.

---

## 4) Deploy / Redeploy

1. Click **Save Changes** in Environment.
2. Click **Manual Deploy** → **Deploy latest commit** (or wait for auto deploy).
3. Wait until status shows **Live**.

---

## 5) Share admin link + credentials

After deploy, copy your Render URL (for example: `https://itfiesta.onrender.com`).

Give admin person:

- **Admin URL**: `https://<your-service>.onrender.com/admin`
- **Username**: value of `ADMIN_USERNAME`
- **Password**: value of `ADMIN_PASSWORD`

### Important behavior

- `/admin` opens login first if not authenticated.
- Only correct credentials can access admin panel.
- Direct access to `admin.html` is restricted by server-side session check.

---

## 6) Optional security best practices

1. Do not share credentials in public chat.
2. Change `ADMIN_PASSWORD` regularly.
3. Keep `SESSION_SECRET` long and random.
4. If admin changes, update env vars and redeploy.

---

## Quick Copy Message for Admin Person

```text
Admin Panel Link: https://<your-service>.onrender.com/admin
Username: <ADMIN_USERNAME>
Password: <ADMIN_PASSWORD>
```
