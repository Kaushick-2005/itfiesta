/* Common JavaScript functions for NPTEL-style Proctored Exam
   Features: Full-screen enforcement, tab-switch detection, back-navigation lock, timer
*/

// Global flag to disable anti-cheat after submission
window.EXAM_SUBMITTED = false;
var escapeHeartbeatTimer = null;
var ESCAPE_HEARTBEAT_INTERVAL_MS = 4000;
var ESCAPE_PENDING_ALERT_KEY = 'escape_pending_alert_message';
var ESCAPE_TAB_HIDDEN_SINCE = 0;
var ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY = 1500;

function queueEscapePenaltyAlert(message) {
  if (!message) return;
  try {
    sessionStorage.setItem(ESCAPE_PENDING_ALERT_KEY, String(message));
  } catch (_) {}
}

function consumeEscapePenaltyAlert() {
  try {
    var msg = sessionStorage.getItem(ESCAPE_PENDING_ALERT_KEY);
    if (msg) {
      sessionStorage.removeItem(ESCAPE_PENDING_ALERT_KEY);
      return msg;
    }
  } catch (_) {}
  return '';
}

function flushEscapePenaltyAlert() {
  if (window.EXAM_SUBMITTED) return;
  if (document.visibilityState !== 'visible') return;

  var msg = consumeEscapePenaltyAlert();
  if (!msg) return;

  // Delay helps on mobile browsers where immediate alert after tab focus may be dropped.
  setTimeout(function(){
    try { alert(msg); } catch (_) {}
  }, 120);
}

function sendEscapeHeartbeat() {
  try {
    if (window.EXAM_SUBMITTED) return;
    if (document.visibilityState === 'hidden') return;

    var teamId = sessionStorage.getItem('teamId') || localStorage.getItem('teamId');
    if (!teamId) return;

    var base = getEscapeApiBase();
    fetch(base + '/api/escape/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId })
    }).catch(function(err){
      console.warn('Escape heartbeat failed', err);
    });
  } catch (e) {
    console.warn('Escape heartbeat failed', e);
  }
}

function startEscapeHeartbeat() {
  stopEscapeHeartbeat();
  sendEscapeHeartbeat();
  escapeHeartbeatTimer = setInterval(sendEscapeHeartbeat, ESCAPE_HEARTBEAT_INTERVAL_MS);
}

function stopEscapeHeartbeat() {
  if (escapeHeartbeatTimer) {
    clearInterval(escapeHeartbeatTimer);
    escapeHeartbeatTimer = null;
  }
}

document.addEventListener('visibilitychange', function() {
  if (window.EXAM_SUBMITTED) return;
  if (document.visibilityState === 'visible') {
    sendEscapeHeartbeat();
    flushEscapePenaltyAlert();
  }
});

window.addEventListener('focus', function(){
  flushEscapePenaltyAlert();
});

window.addEventListener('pagehide', stopEscapeHeartbeat);

function getEscapeApiBase() {
  var origin = (window.location && window.location.origin) ? window.location.origin : '';
  var isLocalHost = (
    window.location &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1')
  );
  var isFileProtocol = window.location && window.location.protocol === 'file:';

  if (window.__API_BASE_URL) return window.__API_BASE_URL;
  if (isLocalHost || isFileProtocol || !origin) return 'http://localhost:3000';
  return origin;
}

function ensureEscapeSessionStart() {
  try {
    var path = (window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
    if (path.indexOf('/escape/levels/') === -1) return;

    var teamId = sessionStorage.getItem('teamId') || localStorage.getItem('teamId');
    if (!teamId) return;

    var base = getEscapeApiBase();
    fetch(base + '/api/escape/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId })
    })
      .then(function(res) {
        return res.json().catch(function(){ return {}; });
      })
      .then(function(data) {
        if (!data) return;

        if (data.status === 'blocked') {
          alert(data.message || 'Access blocked');
          redirectToEliminatedPage();
          return;
        }

        if (data.status === 'completed') {
          if (data.redirect) {
            window.location.replace(data.redirect);
          }
          return;
        }

        if (data.status === 'waiting') {
          alert(data.message || 'Please wait for admin to start your batch.');
          window.location.href = '/escape/leaderboard.html';
          return;
        }

        if (data.reconnectPenalty && data.reconnectPenalty.applied) {
          alert(data.reconnectPenalty.message);
        }

        var currentLevel = Number(data.currentLevel || data.currentRound || 0);
        if (currentLevel) {
          var match = path.match(/level(\d+)\.html/);
          var pageLevel = match ? Number(match[1]) : 0;
          if (pageLevel && pageLevel !== currentLevel) {
            if (currentLevel > 5) {
              window.location.replace('/escape/leaderboard.html');
            } else {
              window.location.replace('/escape/levels/level' + currentLevel + '.html');
            }
            return;
          }
        }
      })
      .catch(function(err) {
        console.warn('Escape start failed', err);
      });
  } catch (e) {
    console.warn('Escape start handler failed', e);
  }
}

document.addEventListener('DOMContentLoaded', ensureEscapeSessionStart);

function getEliminatedPageUrl(){
  try {
    var p = (window.location.pathname || '').toLowerCase();
    if (p.indexOf('/levels/') !== -1) return '../result/eliminated.html';
    if (p.indexOf('/admin/') !== -1) return '../result/eliminated.html';
    if (p.indexOf('/result/') !== -1) return 'eliminated.html';
  } catch(e) {}
  return 'result/eliminated.html';
}

function redirectToEliminatedPage(){
  var url = getEliminatedPageUrl();
  try { window.location.replace(url); }
  catch(e){ window.location.href = url; }
}

function formatTime(totalSeconds) {
  var seconds = Math.max(0, Number(totalSeconds) || 0);
  var min = Math.floor(seconds / 60);
  var sec = seconds % 60;
  return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

// Initialize a countdown timer for a level.
// durationSeconds: total seconds
// displayEl: DOM element (or selector string) where remaining time is shown
// onExpire: callback when timer reaches zero
function initLevelTimer(durationSeconds, displayEl, onExpire) {
  var display = typeof displayEl === 'string' ? document.querySelector(displayEl) : displayEl;
  if (!display) return { stop: function(){} };

  var initial = Math.max(0, Math.round(Number(durationSeconds) || 0));
  var endTime = Date.now() + (initial * 1000);
  var stopped = false;

  function tick() {
    if (stopped) return;
    var remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    display.textContent = formatTime(remaining);

    if (remaining <= 60 && remaining > 0) {
      display.style.color = '#ff6b6b';
    }

    if (remaining <= 0) {
      clearInterval(interval);
      display.textContent = '00:00';
      var shouldDisableInputs = true;
      if (typeof onExpire === 'function') {
        // If callback explicitly returns false, skip forced input disable.
        // Useful for in-flight submission race handling near timeout.
        var onExpireResult = onExpire();
        if (onExpireResult === false) shouldDisableInputs = false;
      }
      if (shouldDisableInputs) disableAllInputs();
    }
  }

  tick();
  var interval = setInterval(tick, 1000);

  return {
    stop: function(){ stopped = true; clearInterval(interval); }
  };
}

// Disable all interactive inputs on the page (used on timeout or elimination)
// Excludes modal buttons so users can still navigate after submission
function disableAllInputs(){
  var inputs = document.querySelectorAll('input, button, textarea, select');
  inputs.forEach(function(el){
    // Don't disable modal buttons (confirmBtn, continueBtn, etc.)
    if (el.id === 'confirmBtn' || el.id === 'continueBtn' || el.closest('.modal-content')) {
      return;
    }
    el.setAttribute('disabled','true');
    el.classList.add('disabled');
  });
}

// Tab switching detection: PENALTY instead of elimination
// Uses cooldown to prevent multiple triggers
var tabSwitchCooldown = false;
var tabLeaveStartedAt = 0;
var tabLeaveReason = '';

function markPotentialTabLeave(reason){
  if (window.EXAM_SUBMITTED) return;
  if (!tabLeaveStartedAt) {
    tabLeaveStartedAt = Date.now();
    tabLeaveReason = String(reason || 'unknown');
  }
}

function handlePotentialTabReturn(source){
  if (window.EXAM_SUBMITTED) return;
  if (tabSwitchCooldown) return;
  if (!tabLeaveStartedAt) return;

  var hiddenForMs = Math.max(0, Date.now() - tabLeaveStartedAt);
  tabLeaveStartedAt = 0;
  tabLeaveReason = '';

  if (hiddenForMs < ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY) {
    console.log('[Common] Ignoring brief hidden/blur state:', hiddenForMs, 'ms from', source);
    return;
  }

  console.log('[Common] Tab/app leave detected. reason=', source, 'hiddenForMs=', hiddenForMs);
  tabSwitchCooldown = true;

  notifyServerTabSwitch(hiddenForMs).then(function(data){
    if (data && data.action === 'penalty') {
      queueEscapePenaltyAlert(data.message || 'Tab/App switch detected. Penalty applied.');
      flushEscapePenaltyAlert();
    }
  }).finally(function(){
    setTimeout(function(){ tabSwitchCooldown = false; }, 3000);
  });
}

function enableTabSwitchPenalty(){
  if (window.__ER_TAB_PENALTY_BOUND) return;
  window.__ER_TAB_PENALTY_BOUND = true;

  console.log('[Common] Tab switch penalty enabled');
  document.addEventListener('visibilitychange', function(){
    console.log('[Common] Visibility changed, state:', document.visibilityState);
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) {
      console.log('[Common] Exam already submitted, skipping penalty');
      return;
    }
    // Skip if cooldown active
    if (tabSwitchCooldown) {
      console.log('[Common] Cooldown active, skipping');
      return;
    }
    
    if (document.visibilityState === 'hidden'){
      ESCAPE_TAB_HIDDEN_SINCE = Date.now();
      markPotentialTabLeave('visibility_hidden');
      return;
    }

    if (document.visibilityState === 'visible') {
      var hiddenForMs = ESCAPE_TAB_HIDDEN_SINCE ? (Date.now() - ESCAPE_TAB_HIDDEN_SINCE) : 0;
      ESCAPE_TAB_HIDDEN_SINCE = 0;

      // Ignore very brief focus flickers (notification shade, quick app switch gestures, etc.)
      if (hiddenForMs < ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY) {
        console.log('[Common] Ignoring brief hidden state:', hiddenForMs, 'ms');
      }

      // Prefer visibility duration if available (most accurate)
      if (hiddenForMs >= ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY) {
        tabLeaveStartedAt = Date.now() - hiddenForMs;
      }
      handlePotentialTabReturn('visibility_visible');
    }
  });

  // Extra signals for browsers/devices where visibilitychange is unreliable.
  window.addEventListener('blur', function(){
    markPotentialTabLeave('window_blur');
  });

  window.addEventListener('focus', function(){
    if (document.visibilityState !== 'hidden') {
      handlePotentialTabReturn('window_focus');
    }
  });

  window.addEventListener('pagehide', function(){
    markPotentialTabLeave('pagehide');
  });

  window.addEventListener('pageshow', function(){
    if (document.visibilityState !== 'hidden') {
      handlePotentialTabReturn('pageshow');
    }
  });
}

// Notify backend of tab switch for penalty
function notifyServerTabSwitch(hiddenMs){
  try {
    var teamId = sessionStorage.getItem('teamId');
    if (!teamId) return Promise.resolve({});
    
    // Use main server API
    var base = (window.location.hostname === 'localhost') ? 'http://localhost:3000' : window.location.origin;
    var url = base + '/api/escape/tab-switch';
    
    return fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ team_id: teamId, hiddenMs: Number(hiddenMs || 0) }) 
    })
    .then(function(res){ return res.json(); })
    .catch(function(err){ 
      console.warn('Failed to notify server of tab switch', err); 
      return {};
    });
  } catch (e) {
    return Promise.resolve({});
  }
}

// Prevent back navigation by pushing a history state
function preventBackNavigation(){
  history.pushState(null, document.title, location.href);
  window.addEventListener('popstate', function(){
    // On back press, push state again to stay on page
    history.pushState(null, document.title, location.href);
    alert('Back navigation is disabled during the exam.');
  });
}

// Soft unload guard: warn before leaving during an active level (mobile browsers may ignore)
function enableBeforeUnloadWarning(){
  // Disabled per event flow requirement:
  // do not show browser "changes not saved" leave/cancel prompt.
  // Progress is server-synced via submit/start state and heartbeat checks.
  return;
}

// Auto-enable all anti-cheat protections
function enableFullExamProtections() {
  enableTabSwitchPenalty();
  preventBackNavigation();
  enableBeforeUnloadWarning();
  startEscapeHeartbeat();
  requestFullScreen();
}

// Request full-screen mode (NPTEL-style)
function requestFullScreen() {
  var elem = document.documentElement;
  var rfs = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
  
  if (rfs) {
    rfs.call(elem).catch(function(err) {
      console.warn('Full-screen request failed:', err);
    });
  }
}

// Detect full-screen exit and apply penalty
function detectFullScreenExit() {
  document.addEventListener('fullscreenchange', function() {
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) return;
    // Skip if already on cooldown
    if (tabSwitchCooldown) return;
    
    if (!document.fullscreenElement && document.fullscreenElement !== null) {
      console.log('Full-screen exited - applying penalty');
      tabSwitchCooldown = true;
      notifyServerTabSwitch().then(function(data){
        if (data && data.action === 'penalty') {
          queueEscapePenaltyAlert(data.message || 'Full-screen exit detected. Penalty applied.');
          flushEscapePenaltyAlert();
        }
      }).finally(function(){
        setTimeout(function(){ tabSwitchCooldown = false; }, 3000);
      });
    }
  });
  document.addEventListener('webkitfullscreenchange', function() {
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) return;
    if (tabSwitchCooldown) return;
    
    if (!document.webkitFullscreenElement) {
      console.log('Full-screen exited (webkit) - applying penalty');
      tabSwitchCooldown = true;
      notifyServerTabSwitch().then(function(data){
        if (data && data.action === 'penalty') {
          queueEscapePenaltyAlert(data.message || 'Full-screen exit detected. Penalty applied.');
          flushEscapePenaltyAlert();
        }
      }).finally(function(){
        setTimeout(function(){ tabSwitchCooldown = false; }, 3000);
      });
    }
  });
  document.addEventListener('mozfullscreenchange', function() {
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) return;
    if (tabSwitchCooldown) return;
    
    if (!document.mozFullScreenElement) {
      console.log('Full-screen exited (moz) - applying penalty');
      tabSwitchCooldown = true;
      notifyServerTabSwitch().then(function(data){
        if (data && data.action === 'penalty') {
          queueEscapePenaltyAlert(data.message || 'Full-screen exit detected. Penalty applied.');
          flushEscapePenaltyAlert();
        }
      }).finally(function(){
        setTimeout(function(){ tabSwitchCooldown = false; }, 3000);
      });
    }
  });
}

// Expose utilities on window for pages
window.ER = window.ER || {};
window.ER.initLevelTimer = initLevelTimer;
window.ER.disableAllInputs = disableAllInputs;
window.ER.enableTabSwitchPenalty = enableTabSwitchPenalty;
window.ER.preventBackNavigation = preventBackNavigation;
window.ER.enableBeforeUnloadWarning = enableBeforeUnloadWarning;
window.ER.enableFullExamProtections = enableFullExamProtections;
window.ER.startEscapeHeartbeat = startEscapeHeartbeat;
window.ER.stopEscapeHeartbeat = stopEscapeHeartbeat;
window.ER.requestFullScreen = requestFullScreen;
window.ER.detectFullScreenExit = detectFullScreenExit;
/* ======================================================
   UNIFIED QUESTION NUMBERING SYSTEM
   Works for all levels - renders clickable question buttons
   ====================================================== */

/**
 * Renders question number buttons in the sidebar
 * @param {Array} questions - Array of question objects
 * @param {number} currentIndex - Currently active question index
 * @param {Object} answeredState - Object tracking which questions are answered {0: true, 1: false, ...}
 * @param {Function} onQuestionClick - Callback when question number is clicked
 * @param {string} containerId - ID of container element (default: 'question-list')
 */
window.ER.renderQuestionNumbers = function(questions, currentIndex, answeredState, onQuestionClick, containerId) {
  var container = document.getElementById(containerId || 'question-list');
  if (!container) {
    console.warn('Question number container not found:', containerId);
    return;
  }
  
  container.innerHTML = '';
  
  if (!Array.isArray(questions) || questions.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No questions loaded</p>';
    return;
  }
  
  questions.forEach(function(_, index) {
    var btn = document.createElement('button');
    btn.className = 'q-btn';
    btn.type = 'button';
    btn.textContent = index + 1;
    
    // Mark as active if current question
    if (index === currentIndex) {
      btn.classList.add('active');
    }
    
    // Mark as answered if state indicates it's completed
    if (answeredState && answeredState[index]) {
      btn.classList.add('answered');
    }
    
    // Click handler to navigate to question
    btn.addEventListener('click', function() {
      if (typeof onQuestionClick === 'function') {
        onQuestionClick(index);
      }
    });
    
    container.appendChild(btn);
  });
};

/**
 * Simplified version that auto-detects container and uses default ID
 * @param {Array} questions - Array of question objects
 * @param {number} currentIndex - Currently active question index
 * @param {Object} answeredState - Object tracking answered questions
 * @param {Function} onQuestionClick - Callback when clicked
 */
window.ER.updateQuestionNumbers = function(questions, currentIndex, answeredState, onQuestionClick) {
  window.ER.renderQuestionNumbers(questions, currentIndex, answeredState, onQuestionClick, 'question-list');
};