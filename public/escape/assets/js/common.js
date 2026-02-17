/* Common JavaScript functions for NPTEL-style Proctored Exam
   Features: Full-screen enforcement, tab-switch detection, back-navigation lock, timer
*/

// Global flag to disable anti-cheat after submission
window.EXAM_SUBMITTED = false;

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
function disableAllInputs(){
  var inputs = document.querySelectorAll('input, button, textarea, select');
  inputs.forEach(function(el){
    el.setAttribute('disabled','true');
    el.classList.add('disabled');
  });
}

// Tab switching detection: PENALTY instead of elimination
// Uses cooldown to prevent multiple triggers
var tabSwitchCooldown = false;

function enableTabSwitchPenalty(){
  window.addEventListener('visibilitychange', function(){
    // Skip if exam is already submitted
    if (window.EXAM_SUBMITTED) return;
    // Skip if cooldown active
    if (tabSwitchCooldown) return;
    
    if (document.visibilityState === 'hidden'){
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
      alert('⚠️ Full-screen mode is required. Please enable it manually and refresh.');
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
