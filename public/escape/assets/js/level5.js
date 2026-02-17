// Level 5: Adaptive Crisis (Dynamic Decision Simulation)
document.addEventListener('DOMContentLoaded', function () {
  console.log('[Level 5] Initializing protections...');
  if (window.ER && window.ER.enableFullExamProtections) {
    window.ER.enableFullExamProtections();
    console.log('[Level 5] Full exam protections enabled');
  } else {
    console.error('[Level 5] ER object or enableFullExamProtections not found!');
  }
  if (window.ER && window.ER.detectFullScreenExit) {
    window.ER.detectFullScreenExit();
    console.log('[Level 5] Full-screen exit detection enabled');
  }

  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) {
    alert('Please start from main page');
    window.location.href = '../index.html';
    return;
  }
  sessionStorage.setItem('currentLevel', '5');

  var scenario = null;
  var currentStageIndex = 0;
  var timerController = null;
  var levelDuration = 600;
  var levelStartTs = Date.now();

  var decisionScore = 0;
  var timeBonus = 0;
  var totalScore = 0;
  var decisionTrail = [];

  var titleEl = document.getElementById('scenarioTitle');
  var stageTextEl = document.getElementById('stageText');
  var optionsEl = document.getElementById('optionsWrap');
  var decisionScoreEl = document.getElementById('decisionScore');
  var timeBonusEl = document.getElementById('timeBonus');
  var totalScoreEl = document.getElementById('totalScore');
  var trailEl = document.getElementById('trailList');
  var statusEl = document.getElementById('statusText');

  function normalizeStageOptions(rawOptions) {
    var list = [];

    if (Array.isArray(rawOptions)) {
      list = rawOptions.slice();
    } else if (rawOptions && typeof rawOptions === 'object') {
      if (Array.isArray(rawOptions.options)) {
        list = rawOptions.options.slice();
      } else {
        list = Object.keys(rawOptions)
          .sort()
          .map(function (k) { return rawOptions[k]; });
      }
    } else if (typeof rawOptions === 'string' && rawOptions.trim()) {
      try {
        var parsed = JSON.parse(rawOptions);
        return normalizeStageOptions(parsed);
      } catch (_) {
        list = [rawOptions];
      }
    }

    return list
      .map(function (opt, idx) {
        if (typeof opt === 'string') {
          return { label: opt, points: 0, next: '' };
        }
        if (!opt || typeof opt !== 'object') return null;

        var label = String(
          opt.label || opt.text || opt.option || opt.action || ('Option ' + (idx + 1))
        );
        var points = Number(
          opt.points !== undefined ? opt.points :
          (opt.score !== undefined ? opt.score :
          (opt.marks !== undefined ? opt.marks : 0))
        );
        var next = String(
          opt.next || opt.nextStage || opt.next_stage || opt.goto || ''
        ).trim();

        return {
          label: label,
          points: Number.isFinite(points) ? points : 0,
          next: next
        };
      })
      .filter(Boolean);
  }

  function showStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'status-line ' + (kind || 'info');
  }

  function updateScoreBoard() {
    decisionScoreEl.textContent = String(decisionScore);
    timeBonusEl.textContent = String(timeBonus);
    totalScoreEl.textContent = String(totalScore);
  }

  function getRemainingSeconds() {
    var elapsed = Math.floor((Date.now() - levelStartTs) / 1000);
    return Math.max(0, levelDuration - elapsed);
  }

  function recomputeTotal() {
    var remaining = getRemainingSeconds();
    // Time bonus remains smaller than decision score so quality of choices dominates.
    timeBonus = Math.floor(remaining / 30);
    totalScore = decisionScore + timeBonus;
    updateScoreBoard();
  }

  function renderTrail() {
    if (!decisionTrail.length) {
      trailEl.innerHTML = '<p class="muted">No decisions made yet.</p>';
      return;
    }

    trailEl.innerHTML = decisionTrail.map(function (d) {
      return '<div class="trail-item">' +
        '<strong>Step ' + d.step + '</strong>: ' + d.action +
        '<div class="muted">Stage: ' + d.stage + ' | Impact: ' + d.points + ' pts</div>' +
      '</div>';
    }).join('');
  }

  function hashTeam(raw) {
    var h = 0;
    String(raw || '').split('').forEach(function (ch) {
      h = ((h << 5) - h) + ch.charCodeAt(0);
      h |= 0;
    });
    return Math.abs(h);
  }

  function pickScenario(list) {
    var key = 'level5_scenario_' + teamId;
    var existing = sessionStorage.getItem(key);
    if (existing) {
      var found = list.find(function (s) { return String(s.id) === String(existing); });
      if (found) return found;
    }

    var idx = hashTeam(teamId) % list.length;
    var chosen = list[idx];
    sessionStorage.setItem(key, String(chosen.id || 'scenario'));
    return chosen;
  }

  function finishEliminated(reason) {
    window.EXAM_SUBMITTED = true;
    if (timerController && timerController.stop) timerController.stop();
    optionsEl.innerHTML = '';
    showStatus('SYSTEM FAILURE. You have been eliminated.', 'danger');

    notifyServerElimination(reason || 'level5_system_failure').finally(function () {
      setTimeout(function () {
        window.location.href = '../result/eliminated.html';
      }, 700);
    });
  }

  function submitSuccess() {
    window.EXAM_SUBMITTED = true;
    if (timerController && timerController.stop) timerController.stop();
    recomputeTotal();

    var payload = {
      decisionScore: decisionScore,
      timeBonus: timeBonus,
      timeRemainingSeconds: getRemainingSeconds(),
      decisions: decisionTrail,
      scenarioId: scenario && scenario.id ? scenario.id : null,
      outcome: 'system_stabilized'
    };

    showStatus('SYSTEM STABILIZED. Submitting your final score...', 'success');
    API.submitScore(teamId, 5, totalScore, payload)
      .then(function (res) {
        if (res && res.success) {
          setTimeout(function () {
            window.location.href = '../result/waiting.html';
          }, 700);
        } else {
          showStatus('Submission failed. Contact admin.', 'danger');
        }
      })
      .catch(function () {
        showStatus('Submission error. Contact admin.', 'danger');
      });
  }

  function getStageIndexById(stageId) {
    if (!scenario || !Array.isArray(scenario.stages)) return -1;
    var needle = String(stageId || '').trim().toLowerCase();
    return scenario.stages.findIndex(function (st) {
      return String(st.id || '').trim().toLowerCase() === needle;
    });
  }

  function renderStage() {
    var stage = scenario && Array.isArray(scenario.stages)
      ? scenario.stages[currentStageIndex]
      : null;

    if (!stage) {
      finishEliminated('level5_invalid_stage');
      return;
    }

    stageTextEl.textContent = stage.text || 'No stage text available.';
    optionsEl.innerHTML = '';

    var stageOptions = normalizeStageOptions(stage.options || stage.actions || stage.choices);

    if (!stageOptions.length) {
      showStatus('No selectable actions found for this stage. Please contact admin.', 'danger');
      return;
    }

    stageOptions.forEach(function (opt, idx) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.textContent = (idx + 1) + '. ' + String(opt.label || 'Option');

      btn.addEventListener('click', function () {
        var buttons = optionsEl.querySelectorAll('button');
        buttons.forEach(function (b) { b.disabled = true; });

        var points = Number(opt.points || 0);
        decisionScore += points;
        decisionTrail.push({
          step: decisionTrail.length + 1,
          stage: String(stage.id || ('stage' + (currentStageIndex + 1))),
          action: String(opt.label || ''),
          points: points,
          timestamp: new Date().toISOString()
        });

        recomputeTotal();
        renderTrail();

        // Optional rule enabled: score below zero => elimination
        if (decisionScore < 0) {
          finishEliminated('level5_score_below_zero');
          return;
        }

        var next = String(opt.next || '').trim();
        if (next && next.toLowerCase() === 'end') {
          submitSuccess();
          return;
        }
        if (next && next.toLowerCase() === 'system_failure') {
          finishEliminated('level5_system_failure');
          return;
        }

        var resolvedIndex = -1;
        if (next) {
          resolvedIndex = getStageIndexById(next);
        }
        if (resolvedIndex < 0) {
          resolvedIndex = currentStageIndex + 1;
        }

        if (resolvedIndex >= scenario.stages.length) {
          submitSuccess();
          return;
        }

        currentStageIndex = resolvedIndex;
        showStatus('Decision recorded. Adapting next crisis state...', 'info');
        setTimeout(renderStage, 320);
      });

      optionsEl.appendChild(btn);
    });
  }

  function startTimer() {
    API.getLevelStart(5)
      .then(function (info) {
        levelDuration = Number(info && info.duration) || 600;

        var startKey = 'timer_start_' + teamId + '_L5';
        var durationKey = 'timer_duration_' + teamId + '_L5';
        var startTs = Number(sessionStorage.getItem(startKey) || 0);
        var storedDuration = Number(sessionStorage.getItem(durationKey) || 0);

        if (!startTs || storedDuration !== levelDuration) {
          startTs = Date.now();
          sessionStorage.setItem(startKey, String(startTs));
          sessionStorage.setItem(durationKey, String(levelDuration));
        }
        levelStartTs = startTs;

        var remaining = getRemainingSeconds();
        if (window.ER && window.ER.initLevelTimer) {
          timerController = window.ER.initLevelTimer(remaining, '#timer-count', function () {
            finishEliminated('timeout_level5');
          });
        }
        recomputeTotal();
      })
      .catch(function () {
        levelDuration = 600;
        levelStartTs = Date.now();
        if (window.ER && window.ER.initLevelTimer) {
          timerController = window.ER.initLevelTimer(levelDuration, '#timer-count', function () {
            finishEliminated('timeout_level5');
          });
        }
        recomputeTotal();
      });
  }

  function normalizeFromDbRows(rows) {
    console.log('[Level 5 Normalize] Starting normalization with', rows ? rows.length : 0, 'scenarios');
    
    if (!Array.isArray(rows) || !rows.length) {
      console.warn('[Level 5 Normalize] No scenarios received from backend');
      return [];
    }

    // Backend now sends pre-grouped scenarios with stages array
    var result = rows.map(function (scenario) {
      console.log('[Level 5 Normalize] Processing scenario', scenario.scenario_id);
      console.log('[Level 5 Normalize] Scenario data:', JSON.stringify(scenario));
      
      if (!scenario.scenario_id) {
        console.warn('[Level 5 Normalize] Scenario missing scenario_id');
        return null;
      }
      
      if (!Array.isArray(scenario.stages) || !scenario.stages.length) {
        console.warn('[Level 5 Normalize] Scenario', scenario.scenario_id, 'has no stages');
        return null;
      }

      var validStages = scenario.stages.map(function (stage) {
        var normalizedOptions = normalizeStageOptions(stage.options || stage.actions || stage.choices);
        console.log('[Level 5 Normalize] Stage', stage.stage, 'has', normalizedOptions.length, 'options');
        
        if (!normalizedOptions.length) {
          console.warn('[Level 5 Normalize] Stage', stage.stage, 'has no valid options - skipping');
          return null;
        }

        return {
          id: 'stage' + String(stage.stage || 1),
          text: stage.text || '',
          options: normalizedOptions
        };
      }).filter(Boolean);

      if (!validStages.length) {
        console.warn('[Level 5 Normalize] Scenario', scenario.scenario_id, 'has no valid stages after normalization');
        return null;
      }

      return {
        id: 'scenario_' + scenario.scenario_id,
        title: scenario.title || 'Adaptive Crisis Scenario',
        stages: validStages
      };
    }).filter(Boolean);
    
    console.log('[Level 5 Normalize] Final result:', result.length, 'scenarios');
    return result;
  }

  function bootstrapScenario() {
    console.log('[Level 5] Fetching scenarios from database...');
    API.fetchQuestions(5)
      .then(function (rows) {
        console.log('[Level 5] Raw DB response:', rows);
        console.log('[Level 5] Total documents fetched:', rows ? rows.length : 0);
        
        var scenarios = normalizeFromDbRows(rows || []);
        console.log('[Level 5] Normalized scenarios:', scenarios);
        console.log('[Level 5] Total scenarios after grouping:', scenarios.length);
        return scenarios;
      })
      .then(function (scenarios) {
        if (!Array.isArray(scenarios) || scenarios.length === 0) {
          console.error('[Level 5] No valid scenarios found after normalization');
          throw new Error('No Level-5 scenarios in DB');
        }

        console.log('[Level 5] Picking scenario for team:', teamId);
        scenario = pickScenario(scenarios);
        console.log('[Level 5] Selected scenario:', scenario);
        currentStageIndex = 0;
        titleEl.textContent = 'Adaptive Crisis Simulation';
        showStatus('Simulation started. No backtracking allowed.', 'info');
        renderStage();
      })
      .catch(function (err) {
        console.error('[Level 5] Failed to load scenarios:', err);
        showStatus('Failed to load Level 5 scenarios from database. Please contact admin.', 'danger');
        if (window.ER && window.ER.disableAllInputs) {
          window.ER.disableAllInputs();
        }
      });
  }

  updateScoreBoard();
  renderTrail();
  startTimer();
  bootstrapScenario();
});