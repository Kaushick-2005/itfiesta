const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const ADMIN_PORT = process.env.ADMIN_PORT || 6000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// Basic auth middleware
app.use(basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASSWORD },
  challenge: true,
  realm: 'ITFiestaAdmin'
}));

// Serve static admin files from workspace admin/ folder
app.use('/', express.static(path.join(__dirname, '..', 'admin')));

// Proxy admin actions to main backend (assumes backend runs on PORT env or 5000)
const fetch = require('node-fetch');
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

app.post('/api/teams/:teamId/advance', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/teams/${req.params.teamId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams/:teamId/eliminate', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/teams/${req.params.teamId}/eliminate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teams', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/teams`);
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/define-level/:level', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/define-level/${req.params.level}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/qualified-teams', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/qualified-teams`);
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/qualified-teams/:level', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/qualified-teams/${req.params.level}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/qualified-teams/:level/add', async (req, res) => {
  try {
    const r = await fetch(`${BACKEND_URL}/api/admin/qualified-teams/${req.params.level}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body || {})
    });
    const body = await r.json();
    res.status(r.status).json(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(ADMIN_PORT, () => console.log(`✓ Admin server running on port ${ADMIN_PORT} (user: ${ADMIN_USER})`));

module.exports = app;
