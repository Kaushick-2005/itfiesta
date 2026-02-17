/* API helper for communicating with Node.js backend (MongoDB Atlas)
   Uses main IT Fiesta server on port 3000
*/

const __safeOrigin = (window.location.origin && window.location.origin !== 'null')
  ? window.location.origin
  : '';
const __isLocalHost = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname === '::1'
);
const __isFileProtocol = window.location.protocol === 'file:';
const DEFAULT_API_BASE_URL = window.__API_BASE_URL || (
  (__isLocalHost || __isFileProtocol || !__safeOrigin)
    ? 'http://localhost:3000'
    : __safeOrigin
);

window.API_BASE_URL = window.__API_BASE_URL || DEFAULT_API_BASE_URL;

window.API = window.API || {};

function getApiBaseUrl() {
  return window.__API_BASE_URL || window.API_BASE_URL || DEFAULT_API_BASE_URL;
}

function getApiBaseCandidates() {
  var candidates = [];
  function push(v) {
    if (!v) return;
    if (candidates.indexOf(v) === -1) candidates.push(v);
  }

  push(window.__API_BASE_URL || '');
  push(getApiBaseUrl());
  push('http://localhost:3000');
  push('http://127.0.0.1:3000');

  if (window.location && window.location.hostname) {
    push(`${window.location.protocol}//${window.location.hostname}:3000`);
  }

  // If app itself is served from backend port, keep same-origin as candidate.
  if (window.location && String(window.location.port) === '3000') {
    push(window.location.origin);
  }

  return candidates;
}

function getAdminBaseUrl() {
  // If admin page is served by admin server itself, use same-origin admin APIs.
  // Otherwise (e.g. static host :8000), use backend APIs directly to avoid cross-origin/auth issues.
  return window.location.port === '6000' ? window.location.origin : getApiBaseUrl();
}

// Fetch questions for a level - uses /api/escape/questions/:level
window.API.fetchQuestions = function(level) {
  const url = `${getApiBaseUrl()}/api/escape/questions/${level}?_=${Date.now()}`;
  return fetch(url, { cache: 'no-store' })
    .then(async res => {
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const errMsg = (data && data.error) ? data.error : ('HTTP ' + res.status);
        throw new Error('Failed to fetch questions: ' + errMsg);
      }
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.questions)) return data.questions;
      return [];
    })
    .catch(err => {
      console.warn('API fetch questions failed', err);
      return [];
    });
};

window.API.fetchLevelQuestionSet = function(level) {
  return window.API.fetchQuestions(level).then(function(list){
    if (!Array.isArray(list)) return { list: [], selected: null };
    var key = 'level_question_id_' + String(level);
    var picked = sessionStorage.getItem(key);
    var selected = null;

    if (picked) {
      selected = list.find(function(q){ return String(q._id) === String(picked); }) || null;
    }
    if (!selected && list.length > 0) {
      selected = list[Math.floor(Math.random() * list.length)];
      if (selected && selected._id) sessionStorage.setItem(key, String(selected._id));
    }
    return { list: list, selected: selected };
  });
};

// Register a team (admin side)
window.API.registerTeam = function(teamId, teamName, username, password, teamMembers) {
  var payload = { teamId, teamName, username, password };
  if (Array.isArray(teamMembers) && teamMembers.length > 0) {
    payload.teamMembers = teamMembers
      .map(function(v){ return String(v || '').trim(); })
      .filter(Boolean);
  }
  return fetch(`${getApiBaseUrl()}/api/teams/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => res.json());
};

// Ensure a team exists (public start flow)
window.API.ensureTeam = async function(teamId, teamName, teamMembers) {
  var payload = { teamId: teamId, teamName: teamName };
  if (Array.isArray(teamMembers) && teamMembers.length > 0) {
    payload.teamMembers = teamMembers
      .map(function(v){ return String(v || '').trim(); })
      .filter(Boolean);
  }
  var lastError = null;
  var candidates = getApiBaseCandidates();

  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i];
    try {
      var res = await fetch(`${base}/api/teams/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var data = await res.json().catch(function(){ return {}; });
      if (res.ok && !(data && data.error)) {
        // pin working base URL for subsequent API calls in this tab
        window.__API_BASE_URL = base;
        window.API_BASE_URL = base;
        return data;
      }

      lastError = new Error((data && data.error) ? data.error : ('HTTP ' + res.status));
    } catch (err) {
      lastError = err;
    }
  }

  throw (lastError || new Error('Failed to fetch'));
};

// Login with username/password (user side)
window.API.login = function(username, password) {
  return fetch(`${getApiBaseUrl()}/api/teams/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(res => res.json());
};

// Submit score for a level - uses /api/escape/submit
window.API.submitScore = function(teamId, level, score) {
  return fetch(`${getApiBaseUrl()}/api/escape/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: teamId, level: level, score: score })
  }).then(res => res.json());
};

// Get all teams (admin only)
window.API.getAllTeams = function() {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/teams`)
    .then(res => res.json())
    .catch(err => { console.error('Failed to fetch teams', err); return []; });
};

// Get single team - uses /api/escape/team/:teamId
window.API.getTeam = function(teamId) {
  return fetch(`${getApiBaseUrl()}/api/escape/team/${teamId}`)
    .then(res => res.json())
    .catch(err => { console.error('Failed to fetch team', err); return null; });
};

// Eliminate a team
window.API.eliminateTeam = function(teamId) {
  const adminBase = getAdminBaseUrl();
  const reason = arguments.length > 1 ? arguments[1] : 'rule_violation';
  return fetch(`${adminBase}/api/teams/${teamId}/eliminate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason })
  }).then(res => res.json());
};

// Advance a team to next level (admin)
window.API.advanceTeam = function(teamId) {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/teams/${teamId}/advance`, {
    method: 'POST'
  }).then(res => res.json());
};

// Admin override: re-advance an eliminated team in exceptional situations
window.API.overrideAdvanceTeam = function(teamId, reason) {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/teams/${teamId}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      overrideElimination: true,
      reason: reason || 'admin_override_reinstated'
    })
  }).then(res => res.json());
};

// Get server-synced level start timestamp and duration
window.API.getLevelStart = function(level) {
  return fetch(`${getApiBaseUrl()}/api/escape/level/${level}/start`)
    .then(res => res.json())
    .catch(err => {
      console.warn('Failed to get server time', err);
      const defaults = { 1: 180, 2: 240, 3: 300, 4: 360, 5: 600 };
      return { serverNow: Date.now(), duration: defaults[level] || 300 };
    });
};

// Tab switch penalty - uses /api/escape/tab-switch
window.API.tabSwitch = function(teamId) {
  return fetch(`${getApiBaseUrl()}/api/escape/tab-switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ team_id: teamId })
  }).then(res => res.json());
};

// Get level definition (prompt, correctAnswer, attemptsAllowed, durationSeconds)
window.API.getLevelDefinition = function(level) {
  return fetch(`${getApiBaseUrl()}/api/level/${level}/definition`)
    .then(res => res.json())
    .catch(err => { console.warn('Failed to get level definition', err); return null; });
};

// Submit survival-gate level answer
window.API.submitLevelAnswer = function(level, teamId, answer, extra) {
  var payload = { teamId: teamId, answer: answer };
  if (extra && typeof extra === 'object') {
    payload = Object.assign(payload, extra);
  }
  return fetch(`${getApiBaseUrl()}/api/levels/${level}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => res.json());
};

// Admin: define level (proxied through admin server when available)
window.API.adminDefineLevel = function(level, payload) {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/admin/define-level/${level}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => res.json());
};

// Admin: qualified teams by level
window.API.getQualifiedTeams = function() {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/admin/qualified-teams`)
    .then(res => res.json())
    .catch(err => { console.error('Failed to fetch qualified teams', err); return { success: false, levels: [] }; });
};

window.API.setQualifiedTeamsForLevel = function(level, teamIds) {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/admin/qualified-teams/${level}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamIds: Array.isArray(teamIds) ? teamIds : [] })
  }).then(res => res.json());
};

window.API.addQualifiedTeamForLevel = function(level, teamId) {
  const adminBase = getAdminBaseUrl();
  return fetch(`${adminBase}/api/admin/qualified-teams/${level}/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId })
  }).then(res => res.json());
};
