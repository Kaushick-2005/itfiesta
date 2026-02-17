// Admin dashboard logic

function teamLabel(team) {
  return team.teamName || team.teamId;
}

function isLevelCompleted(team, level) {
  return !!(
    team[`level${level}_submitted`] ||
    team[`level${level}_solvedAt`] ||
    Number(team[`level${level}_score`] || 0) > 0 ||
    Number(team.currentLevel || 1) > level
  );
}

function parseTime(value) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

function sortByScoreAndTime(level) {
  return function(a, b) {
    const sa = Number(a[`level${level}_score`] || 0);
    const sb = Number(b[`level${level}_score`] || 0);
    if (sb !== sa) return sb - sa;
    return parseTime(a[`level${level}_solvedAt`]) - parseTime(b[`level${level}_solvedAt`]);
  };
}

function getQualifiedMap() {
  return window._QUALIFIED_BY_LEVEL || {};
}

function getQualifiedIds(level) {
  var map = getQualifiedMap();
  var arr = map[level] || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(function(v){ return String(v || '').trim().toUpperCase(); }).filter(Boolean);
}

function getQualifiedSet(level) {
  return new Set(getQualifiedIds(level));
}

function parseTeamNumbersInput(raw) {
  if (!raw) return [];
  var parts = String(raw)
    .split(/[\s,\n\r\t]+/)
    .map(function(v){ return String(v || '').trim().toUpperCase(); })
    .filter(Boolean);
  var seen = new Set();
  var out = [];
  parts.forEach(function(id) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  });
  return out;
}

function renderAllTeams(teams) {
  const container = document.getElementById('teamsContainer');
  if (!teams || teams.length === 0) {
    container.innerHTML = '<p class="muted">No teams registered.</p>';
    return;
  }

  container.innerHTML = teams.map(function(team) {
    const members = Array.isArray(team.teamMembers) ? team.teamMembers.filter(Boolean) : [];
    const membersHtml = members.length > 0
      ? `<div class="muted-small" style="margin-top:6px;">Members: ${members.join(', ')}</div>`
      : '';
    return `
      <div class="team-card ${team.eliminated ? 'eliminated' : ''}">
        <div class="team-header">
          <div class="team-name">${teamLabel(team)}</div>
          <span class="muted" style="font-size:0.85rem">${team.eliminated ? 'ELIMINATED' : `Level ${team.currentLevel || 1}`}</span>
        </div>
        ${membersHtml}
        <div class="scores">
          <div class="score-item"><span>L1:</span><strong>${team.level1_score || 0}${team.level1_submitted ? '✓' : ''}</strong></div>
          <div class="score-item"><span>L2:</span><strong>${team.level2_score || 0}${team.level2_submitted ? '✓' : ''}</strong></div>
          <div class="score-item"><span>L3:</span><strong>${team.level3_score || 0}${team.level3_submitted ? '✓' : ''}</strong></div>
          <div class="score-item"><span>L4:</span><strong>${team.level4_score || 0}${team.level4_submitted ? '✓' : ''}</strong></div>
          <div class="score-item"><span>L5:</span><strong>${team.level5_score || 0}${team.level5_submitted ? '✓' : ''}</strong></div>
        </div>
        ${!team.eliminated ? `
          <div class="team-actions">
            <button class="btn-advance" onclick="advanceTeam('${team.teamId}')">Advance</button>
            <button class="btn-eliminate" onclick="eliminateTeam('${team.teamId}')">Eliminate</button>
          </div>
        ` : `
          <div class="team-actions">
            <button class="btn-override" onclick="overrideAdvanceTeam('${team.teamId}')">Override Advance (Emergency)</button>
          </div>
        `}
      </div>
    `;
  }).join('');
}

function renderLevelBoards() {
  const root = document.getElementById('levelBoards');
  const teams = window._ADMIN_TEAMS || [];
  const qualifiedMap = getQualifiedMap();
  const n = Math.max(1, Number(document.getElementById('autoAdvanceCount').value || 3));

  const cards = [];

  for (let level = 1; level <= 5; level++) {
    const qualifiedIds = getQualifiedIds(level);
    const qualifiedSet = getQualifiedSet(level);
    const completed = teams.filter(function(t) { return isLevelCompleted(t, level); }).sort(sortByScoreAndTime(level));
    const awaiting = completed.filter(function(t) {
      return !t.eliminated && Number(t.currentLevel || 1) <= level && !qualifiedSet.has(String(t.teamId || '').toUpperCase());
    });
    const shortlist = awaiting.slice(0, n);

    const completedHtml = completed.length > 0
      ? completed.map(function(t, idx) {
          const solvedAt = t[`level${level}_solvedAt`] ? new Date(t[`level${level}_solvedAt`]).toLocaleString() : '-';
          const score = Number(t[`level${level}_score`] || 0);
          return `<div class="list-row"><strong>${idx + 1}. ${teamLabel(t)}</strong><br><span class="muted-small">Score: ${score} | Solved: ${solvedAt} | Current Level: ${t.currentLevel || 1}${t.eliminated ? ' | ELIMINATED' : ''}</span></div>`;
        }).join('')
      : '<p class="muted">No completed teams.</p>';

    const shortlistHtml = shortlist.length > 0
      ? shortlist.map(function(t, idx) {
          const solvedAt = t[`level${level}_solvedAt`] ? new Date(t[`level${level}_solvedAt`]).toLocaleString() : '-';
          const score = Number(t[`level${level}_score`] || 0);
          const nextLabel = level >= 5 ? 'Winner' : ('Level ' + (level + 1));
          return `<div class="list-row"><strong>${idx + 1}. ${teamLabel(t)}</strong><br><span class="muted-small">Score: ${score} | Solved: ${solvedAt}</span><br><button class="qualify-btn" onclick="qualifyFromLevel('${t.teamId}', ${level})">Qualify to ${nextLabel}</button></div>`;
        }).join('')
      : '<p class="muted">No pending teams (already qualified / eliminated / not solved).</p>';

    const qualifiedHtml = qualifiedIds.length > 0
      ? qualifiedIds.map(function(teamId, idx) {
          return `<div class="list-row"><strong>${idx + 1}. ${teamId}</strong></div>`;
        }).join('')
      : '<p class="muted">No qualified team numbers stored for this level.</p>';

    const presetValue = (qualifiedMap[level] || []).join(', ');

    cards.push(`
      <div class="section-card" style="margin:0;">
        <h4 style="margin:0 0 8px 0;color:#a5b4fc;">Level ${level}</h4>
        <div class="muted-small" style="margin-bottom:6px;">Qualified Team Numbers (DB)</div>
        <div class="mini-list" style="margin-bottom:8px;">${qualifiedHtml}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;">
          <input id="qualifiedInputLevel${level}" type="text" value="${presetValue.replace(/"/g, '&quot;')}" placeholder="TEAM01, TEAM02" style="flex:1;padding:8px;border-radius:6px;border:1px solid rgba(255, 255, 255, 0.08);background:var(--card);color:#fff;" />
          <button class="qualify-btn" onclick="saveQualifiedTeamNumbers(${level})">Save Team Numbers</button>
        </div>
        <div class="muted-small" style="margin-bottom:6px;">Completed Teams</div>
        <div class="mini-list" style="margin-bottom:10px;">${completedHtml}</div>
        <div class="muted-small" style="margin-bottom:6px;">Top ${n} Awaiting Qualification (manual)</div>
        <div class="mini-list">${shortlistHtml}</div>
      </div>
    `);
  }

  root.innerHTML = cards.join('');
}

function renderViolations() {
  const list = document.getElementById('violationsList');
  const teams = window._ADMIN_TEAMS || [];
  const records = [];

  teams.forEach(function(team) {
    (team.violationRecords || []).forEach(function(v) {
      records.push({
        teamName: teamLabel(team),
        reason: v.reason || 'rule_violation',
        timestamp: v.timestamp || ''
      });
    });
  });

  records.sort(function(a, b) { return parseTime(b.timestamp) - parseTime(a.timestamp); });
  if (records.length === 0) {
    list.innerHTML = '<p class="muted">No recent violations.</p>';
    return;
  }

  list.innerHTML = records.slice(0, 100).map(function(r) {
    const when = r.timestamp ? new Date(r.timestamp).toLocaleString() : '-';
    return `<div class="list-row"><strong>${r.teamName}</strong><br><span class="muted-small">${r.reason} — ${when}</span></div>`;
  }).join('');
}

async function refreshTeams() {
  const [teams, qualified] = await Promise.all([
    window.API.getAllTeams(),
    window.API.getQualifiedTeams()
  ]);
  window._ADMIN_TEAMS = Array.isArray(teams) ? teams : [];

  const map = {};
  if (qualified && qualified.success && Array.isArray(qualified.levels)) {
    qualified.levels.forEach(function(entry) {
      const level = Number(entry && entry.level);
      if (!level) return;
      map[level] = Array.isArray(entry.qualifiedTeamIds)
        ? entry.qualifiedTeamIds.map(function(v){ return String(v || '').trim().toUpperCase(); }).filter(Boolean)
        : [];
    });
  }
  window._QUALIFIED_BY_LEVEL = map;

  document.getElementById('totalTeams').textContent = window._ADMIN_TEAMS.length;
  document.getElementById('activeTeams').textContent = window._ADMIN_TEAMS.filter(function(t){ return !t.eliminated; }).length;
  document.getElementById('level1Submitted').textContent = window._ADMIN_TEAMS.filter(function(t){ return isLevelCompleted(t, 1); }).length;

  renderAllTeams(window._ADMIN_TEAMS);
  renderLevelBoards();
  renderViolations();
}

async function saveQualifiedTeamNumbers(level) {
  const input = document.getElementById('qualifiedInputLevel' + level);
  if (!input) return;
  const ids = parseTeamNumbersInput(input.value);
  const res = await window.API.setQualifiedTeamsForLevel(level, ids);
  if (!res || !res.success) {
    alert('Failed to save qualified team numbers for Level ' + level);
    return;
  }
  if (res.missingTeamIds && res.missingTeamIds.length > 0) {
    alert('Saved. Some team numbers were not found and skipped: ' + res.missingTeamIds.join(', '));
  }
  await refreshTeams();
}

async function eliminateTeam(teamId) {
  const reason = prompt('Reason for elimination (required for violation log):', 'rule_violation');
  if (reason === null) return;
  if (!confirm('Eliminate team ' + teamId + '?')) return;
  const res = await window.API.eliminateTeam(teamId, reason || 'rule_violation');
  if (res && res.success) {
    alert('Team eliminated');
    refreshTeams();
  } else {
    alert('Failed to eliminate team');
  }
}

async function advanceTeam(teamId) {
  if (!confirm('Advance team ' + teamId + ' to next level?')) return;
  const res = await window.API.advanceTeam(teamId);
  if (res && res.success) {
    alert('Team advanced to level ' + (res.team && res.team.currentLevel));
    refreshTeams();
  } else {
    alert((res && res.error) || 'Failed to advance team');
  }
}

async function overrideAdvanceTeam(teamId) {
  var team = (window._ADMIN_TEAMS || []).find(function(t){ return String(t.teamId) === String(teamId); });
  if (!team || !team.eliminated) {
    alert('Override is only allowed for eliminated teams in unfortunate situations.');
    return;
  }

  const reason = prompt('Override reason (required):', 'admin_override_reinstated');
  if (reason === null) return;
  if (!confirm('Reinstate and advance eliminated team ' + teamId + '?')) return;

  const res = await window.API.overrideAdvanceTeam(teamId, reason || 'admin_override_reinstated');
  if (res && res.success) {
    alert('Override success. Team moved to level ' + (res.team && res.team.currentLevel));
    refreshTeams();
  } else {
    alert((res && res.error) || 'Failed to override advance');
  }
}

async function qualifyFromLevel(teamId, level) {
  const nextLabel = level >= 5 ? 'Winner' : ('Level ' + (level + 1));
  if (!confirm(`Qualify ${teamId} from Level ${level} to ${nextLabel}?`)) return;
  const saveRes = await window.API.addQualifiedTeamForLevel(level, teamId);
  if (!saveRes || !saveRes.success) {
    alert((saveRes && saveRes.error) || 'Failed to store qualified team number');
    return;
  }
  const res = await window.API.advanceTeam(teamId);
  if (res && res.success) {
    refreshTeams();
  } else {
    alert('Failed to qualify team');
  }
}

document.getElementById('autoAdvanceCount').addEventListener('change', renderLevelBoards);

setInterval(refreshTeams, 5000);
refreshTeams();
