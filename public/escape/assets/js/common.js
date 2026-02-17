/* Common JavaScript functions for NPTEL-style Proctored Exam
   Features: Full-screen enforcement, tab-switch detection, back-navigation lock, timer
*/

// Global flag to disable anti-cheat after submission
window.EXAM_SUBMITTED = false;

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

    var startKey = 'escape_start_ok_' + String(teamId);
    if (sessionStorage.getItem(startKey) === '1') return;

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
            window.location.href = data.redirect;
          }
          return;
        }

        if (data.status === 'waiting') {
          alert(data.message || 'Please wait for admin to start your batch.');
          window.location.href = '/escape/result/waiting.html';
          return;
        }

        var currentLevel = Number(data.currentLevel || data.currentRound || 0);
        if (currentLevel) {
          var match = path.match(/level(\d+)\.html/);
          var pageLevel = match ? Number(match[1]) : 0;
          if (pageLevel && pageLevel !== currentLevel) {
            window.location.href = '/escape/levels/level' + currentLevel + '.html';
            return;
          }
        }

        sessionStorage.setItem(startKey, '1');
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

function enableTabSwitchPenalty(){
  console.log('[Common] Tab switch penalty enabled');
  window.addEventListener('visibilitychange', function(){
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
      console.log('[Common] Tab switch detected! Applying penalty...');
      tabSwitchCooldown = true;
      
      // Apply penalty via API
      notifyServerTabSwitch().then(function(data){
        if (data && data.action === 'penalty') {
          alert(data.message);
        }
      }).finally(function(){
        // 3 second cooldown
        setTimeout(function(){ tabSwitchCooldown = false; }, 3000);
      });
    }
  });
}

// Notify backend of tab switch for penalty
function notifyServerTabSwitch(){
  try {
    var teamId = sessionStorage.getItem('teamId');
    if (!teamId) return Promise.resolve({});
    
    // Use main server API
    var base = (window.location.hostname === 'localhost') ? 'http://localhost:3000' : window.location.origin;
    var url = base + '/api/escape/tab-switch';
    
    return fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ team_id: teamId }) 
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
  window.addEventListener('beforeunload', function(e){
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) return;
    
    var confirmationMessage = 'Are you sure you want to leave? Progress will be lost.';
    (e || window.event).returnValue = confirmationMessage;
    return confirmationMessage;
  });
}

// Auto-enable all anti-cheat protections
function enableFullExamProtections() {
  enableTabSwitchPenalty();
  preventBackNavigation();
  enableBeforeUnloadWarning();
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
          alert(data.message);
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
          alert(data.message);
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
          alert(data.message);
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