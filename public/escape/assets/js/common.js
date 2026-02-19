/* Common JavaScript functions for NPTEL-style Proctored Exam
   Features: Full-screen enforcement, tab-switch detection, back-navigation lock, timer
*/

// Global flag to disable anti-cheat after submission
window.EXAM_SUBMITTED = false;
var escapeHeartbeatTimer = null;
var ESCAPE_HEARTBEAT_INTERVAL_MS = 4000;
var ESCAPE_PENDING_ALERT_KEY = 'escape_pending_alert_message';
var ESCAPE_TAB_HIDDEN_SINCE = 0;
var ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY = 1000; // STRICT: 1000ms (1 second) - reduces false positives from UI interactions

// Enhanced detection state tracking
var detectionState = {
  isHidden: false,
  hideStartTime: 0,
  lastDetectionTime: 0,
  pendingDetection: null,
  detectionCount: 0
};

// Comprehensive browser and device detection
var browserInfo = {
  isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || ''),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent || ''),
  isAndroid: /Android/.test(navigator.userAgent || ''),
  isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || ''),
  browser: (function() {
    var ua = navigator.userAgent || '';
    if (ua.includes('Chrome')) return 'chrome';
    if (ua.includes('Firefox')) return 'firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'safari';
    if (ua.includes('Edge')) return 'edge';
    return 'other';
  })()
};

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

// Enhanced tab switching detection: PENALTY instead of elimination
// Uses cooldown to prevent multiple triggers
var tabSwitchCooldown = false;
var tabLeaveStartedAt = 0;
var tabLeaveReason = '';

function markPotentialTabLeave(reason) {
  if (window.EXAM_SUBMITTED || tabSwitchCooldown) return;
  
  var now = Date.now();
  // Improved validation to reduce false positives
  var isLikelyUserAction = !reason.includes('blur') || (reason.includes('delayed') && now - (detectionState.lastDetectionTime || 0) > 3000);
  
  if (!detectionState.isHidden && isLikelyUserAction) {
    detectionState.isHidden = true;
    detectionState.hideStartTime = now;
    tabLeaveStartedAt = now;
    tabLeaveReason = String(reason || 'unknown');
    
    console.log('[TabDetect] Page hidden:', reason, 'at', new Date(now).toISOString());
  }
}

function handlePotentialTabReturn(source) {
  if (window.EXAM_SUBMITTED || tabSwitchCooldown || !detectionState.isHidden) return;

  var now = Date.now();
  var hiddenDuration = now - detectionState.hideStartTime;
  
  // Reset detection state
  detectionState.isHidden = false;
  detectionState.hideStartTime = 0;
  tabLeaveStartedAt = 0;
  tabLeaveReason = '';

  console.log('[TabDetect] Page visible:', source, 'hidden for', hiddenDuration + 'ms');

  // Clear any pending detection
  if (detectionState.pendingDetection) {
    clearTimeout(detectionState.pendingDetection);
    detectionState.pendingDetection = null;
  }

  // IMPROVED VALIDATION: Stricter detection with better false positive filtering
  if (!isLegitimateTabSwitch(hiddenDuration, source)) {
    console.log('[TabDetect] Not a legitimate tab switch, ignoring');
    return;
  }

  // Reduce cooldown for quick consecutive detections but prevent spam
  if (now - detectionState.lastDetectionTime < 1000) {
    console.log('[TabDetect] Too soon since last detection, ignoring');
    return;
  }

  detectionState.lastDetectionTime = now;
  detectionState.detectionCount++;
  
  console.log('[TabDetect] Legitimate tab switch detected:', {
    source: source,
    duration: hiddenDuration,
    count: detectionState.detectionCount
  });

  applyTabSwitchPenalty(hiddenDuration);
}

// Validate if the detected event is likely a legitimate tab switch
function isLegitimateTabSwitch(hiddenMs, source) {
  // BALANCED STRICT: Quick detection while filtering obvious false positives
  if (hiddenMs < ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY) {
    return false;
  }

  // Filter out browser dev tools, zoom operations, and accidental triggers
  if (hiddenMs < 1500 && (source.includes('blur') && !source.includes('delayed'))) {
    console.log('[TabDetect] Filtering potential dev tools/zoom/UI operation:', hiddenMs, 'ms');
    return false;
  }

  // Too long - likely system sleep or phone lock
  if (hiddenMs > 600000) { // 10 minutes
    console.log('[TabDetect] Very long period, likely system issue:', hiddenMs);
    return false;
  }

  // STRICT MOBILE DETECTION: Fine-tuned for better accuracy
  if (browserInfo.isMobile) {
    // Filter very brief mobile browser UI interactions
    if (hiddenMs < 1500 && source.includes('blur') && !source.includes('delayed')) {
      return false; // Filter immediate mobile blur events
    }
    
    // iOS Safari: Slightly more lenient but still strict
    if (browserInfo.isIOS && hiddenMs < 1800 && source.includes('pagehide')) {
      return false; // iOS Safari pagehide filtering
    }
  }

  return true;
}

function applyTabSwitchPenalty(hiddenMs) {
  tabSwitchCooldown = true;
  
  // Show immediate feedback alert
  var immediateMessage = 'TAB SWITCH DETECTED!\n⏱️ Duration: ' + hiddenMs + 'ms\n\n⏳ Processing penalty...';
  
  // Show immediate alert
  setTimeout(function() {
    try { 
      alert(immediateMessage); 
    } catch (_) {}
  }, 50);
  
  // Process server penalty
  console.log('[TabDetect] Notifying server of tab switch:', hiddenMs + 'ms');
  
  notifyServerTabSwitch(hiddenMs).then(function(data) {
    console.log('[TabDetect] Server response:', data);
    
    if (data && data.action === 'penalty') {
      // Show the actual penalty response from server
      var penaltyMessage = data.message || 
        ('TAB SWITCH PENALTY APPLIED!\n\n' +
         '❌ Score Deducted: -' + (data.scoreDeducted || 10) + ' marks\n' +
         '📊 Current Score: ' + (data.currentScore || 0) + '\n' +
         '🔢 Total Violations: ' + (data.tabSwitchCount || 1) + '\n\n' +
         '⚠️ Stay focused on the exam!');
      
      // Show penalty details after short delay
      setTimeout(function() {
        try { 
          alert(penaltyMessage); 
        } catch (_) {}
      }, 1500);
      
    } else if (data && data.action === 'ignored') {
      console.log('[TabDetect] Server ignored detection:', data.reason);
      // Show cancellation message if server ignored
      setTimeout(function() {
        try { 
          alert('Tab switch detected but no penalty applied.\nReason: ' + (data.reason || 'Unknown')); 
        } catch (_) {}
      }, 1000);
    } else if (data && data.error) {
      console.error('[TabDetect] Server error:', data.error);
      setTimeout(function() {
        try { 
          alert('Tab switch detected but penalty processing failed.\nError: ' + data.error); 
        } catch (_) {}
      }, 1000);
    } else {
      console.warn('[TabDetect] Unexpected server response:', data);
    }
  }).catch(function(err) {
    console.error('[TabDetect] Server notification failed:', err);
    // Show error message to user
    setTimeout(function() {
      try { 
        alert('Tab switch detected but server connection failed.\nPenalty may not be applied.\nError: ' + err.message); 
      } catch (_) {}
    }, 1000);
  }).finally(function() {
    setTimeout(function() { 
      tabSwitchCooldown = false; 
    }, 1500);
  });
}

function enableTabSwitchPenalty(){
  if (window.__ER_TAB_PENALTY_BOUND) return;
  window.__ER_TAB_PENALTY_BOUND = true;

  console.log('[TabDetect] Enhanced tab switch penalty system enabled');
  console.log('[TabDetect] Device Info:', browserInfo);
  
  // Reset detection state
  detectionState.isHidden = false;
  detectionState.hideStartTime = 0;
  detectionState.lastDetectionTime = 0;
  detectionState.detectionCount = 0;

  // Primary detection: visibilitychange API (most reliable across all platforms)
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Secondary detection: Page lifecycle events for broader coverage
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);
  
  // Mobile-specific detection for app switching
  if (browserInfo.isMobile) {
    setupMobileDetection();
  }
  
  // Desktop-specific detection with enhanced validation
  if (browserInfo.isDesktop) {
    setupDesktopDetection();
  }
  
  // Cross-platform backup detection for edge cases
  setupBackupDetection();
}

function handleVisibilityChange() {
  console.log('[TabDetect] Visibility change:', document.visibilityState);
  
  if (window.EXAM_SUBMITTED) {
    console.log('[TabDetect] Exam submitted, ignoring');
    return;
  }

  if (document.visibilityState === 'hidden') {
    markPotentialTabLeave('visibility_hidden');
  } else if (document.visibilityState === 'visible') {
    handlePotentialTabReturn('visibility_visible');
  }
}

function handlePageHide() {
  if (!detectionState.isHidden) {
    console.log('[TabDetect] Page hide event');
    markPotentialTabLeave('pagehide');
  }
}

function handlePageShow() {
  if (detectionState.isHidden && document.visibilityState === 'visible') {
    console.log('[TabDetect] Page show event');
    handlePotentialTabReturn('pageshow');
  }
}

function setupMobileDetection() {
  console.log('[TabDetect] Setting up mobile-optimized detection');
  
  // Mobile app switching detection - ACCURATE with reduced false positives
  if (browserInfo.isAndroid) {
    // Android-specific handling - conservative delay to reduce false positives
    window.addEventListener('blur', function() {
      setTimeout(function() {
        if (document.visibilityState !== 'hidden' && !detectionState.isHidden) {
          markPotentialTabLeave('android_blur_delayed');
        }
      }, 800); // Conservative delay: reduces false positives from UI interactions
    });
  }
  
  if (browserInfo.isIOS) {
    // iOS Safari-specific handling - ACCURATE with minimal false positives
    var iosBlurTimeout;
    window.addEventListener('blur', function() {
      iosBlurTimeout = setTimeout(function() {
        if (document.visibilityState !== 'hidden' && !detectionState.isHidden) {
          markPotentialTabLeave('ios_blur_delayed');
        }
      }, 1000); // Higher threshold to prevent false positives from iOS Safari UI
    });
    
    window.addEventListener('focus', function() {
      if (iosBlurTimeout) {
        clearTimeout(iosBlurTimeout);
        iosBlurTimeout = null;
      }
    });
  }
  
  // Touch event handling (detect when user switches apps during touch)
  var touchStartTime = 0;
  document.addEventListener('touchstart', function() {
    touchStartTime = Date.now();
  });
  
  document.addEventListener('touchend', function() {
    // If touch duration was very long, user might have switched apps
    var touchDuration = Date.now() - touchStartTime;
    if (touchDuration > 3000 && document.visibilityState === 'hidden') {
      console.log('[TabDetect] Long touch detected with hidden state');
    }
  });
}

function setupDesktopDetection() {
  console.log('[TabDetect] Setting up desktop-optimized detection');
  
  var desktopBlurTimeout;
  var focusRestoreTimeout;
  
  window.addEventListener('blur', function() {
    // Clear any existing timeout
    if (desktopBlurTimeout) {
      clearTimeout(desktopBlurTimeout);
    }
    
    desktopBlurTimeout = setTimeout(function() {
      // Only mark as tab leave if page is still not hidden by visibility API
      // and we haven't already detected it
      if (document.visibilityState !== 'hidden' && !detectionState.isHidden) {
        console.log('[TabDetect] Desktop blur timeout triggered');
        markPotentialTabLeave('desktop_blur_delayed');
      }
    }, 200); // Fast desktop detection while avoiding dev tools false positives
  });
  
  window.addEventListener('focus', function() {
    // Clear blur timeout if focus returns quickly
    if (desktopBlurTimeout) {
      clearTimeout(desktopBlurTimeout);
      desktopBlurTimeout = null;
    }
    
    // Handle focus return with optimized delay
    focusRestoreTimeout = setTimeout(function() {
      if (detectionState.isHidden && document.visibilityState === 'visible') {
        console.log('[TabDetect] Desktop focus return');
        handlePotentialTabReturn('desktop_focus_delayed');
      }
    }, 100); // Fast focus restoration
  });
  
  // Additional desktop-specific events
  document.addEventListener('keydown', function(e) {
    // Detect Alt+Tab, Ctrl+Tab, Windows key, etc.
    if ((e.altKey && e.key === 'Tab') || (e.ctrlKey && e.key === 'Tab') || e.key === 'Meta') {
      console.log('[TabDetect] Tab switching hotkey detected:', e.key);
      // Mark potential but don't immediately trigger - wait for visibility change
      setTimeout(function() {
        if (document.visibilityState === 'hidden' && !detectionState.isHidden) {
          markPotentialTabLeave('hotkey_tab_switch');
        }
      }, 100);
    }
  });
}

function setupBackupDetection() {
  // Additional fallback detection for browsers with quirky behavior
  var backupCheckInterval;
  
  function startBackupMonitoring() {
    if (backupCheckInterval) return;
    
    backupCheckInterval = setInterval(function() {
      // Check if page has been hidden for a while but not detected
      if (document.visibilityState === 'hidden' && !detectionState.isHidden) {
        console.log('[TabDetect] Backup detection: page hidden but not detected');
        markPotentialTabLeave('backup_detection');
      }
      
      // Check if page is visible but we think it's hidden
      if (document.visibilityState === 'visible' && detectionState.isHidden) {
        var hiddenDuration = Date.now() - detectionState.hideStartTime;
        if (hiddenDuration > 500) { // Quick backup detection
          console.log('[TabDetect] Backup detection: page visible but state thinks hidden');
          handlePotentialTabReturn('backup_visible_detection');
        }
      }
    }, 1000); // More frequent checking for better responsiveness
  }
  
  function stopBackupMonitoring() {
    if (backupCheckInterval) {
      clearInterval(backupCheckInterval);
      backupCheckInterval = null;
    }
  }
  
  // Start backup monitoring when tab detection is enabled
  startBackupMonitoring();
  
  // Stop monitoring when exam is completed
  window.addEventListener('beforeunload', stopBackupMonitoring);
}

// Notify backend of tab switch for penalty
function notifyServerTabSwitch(hiddenMs){
  try {
    var teamId = sessionStorage.getItem('teamId');
    if (!teamId) {
      console.warn('[TabDetect] No team ID found in session storage');
      return Promise.resolve({ error: 'No team ID' });
    }
    
    // Improved server URL detection
    var base = getEscapeApiBase();
    var url = base + '/api/escape/tab-switch';
    
    console.log('[TabDetect] Sending penalty request to:', url, 'for team:', teamId, 'duration:', hiddenMs + 'ms');
    
    return fetch(url, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ team_id: teamId, hiddenMs: Number(hiddenMs || 0) }) 
    })
    .then(function(res){
      if (!res.ok) {
        throw new Error('Server responded with status: ' + res.status);
      }
      return res.json();
    })
    .catch(function(err){ 
      console.error('[TabDetect] Failed to notify server of tab switch:', err); 
      return { error: 'Network error: ' + err.message };
    });
  } catch (e) {
    console.error('[TabDetect] Exception in notifyServerTabSwitch:', e);
    return Promise.resolve({ error: 'Exception: ' + e.message });
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

// Debug utilities for monitoring tab switch behavior and penalty system
window.ER.getTabSwitchDebugInfo = function() {
  return {
    cooldownActive: tabSwitchCooldown,
    currentlyHidden: document.visibilityState === 'hidden',
    detectionState: detectionState,
    browserInfo: browserInfo,
    hiddenSince: ESCAPE_TAB_HIDDEN_SINCE,
    tabLeaveTime: tabLeaveStartedAt,
    examSubmitted: window.EXAM_SUBMITTED || false,
    thresholdMs: ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY
  };
};

// Expose penalty function for testing
window.ER.testPenalty = applyTabSwitchPenalty;
window.ER.notifyServer = notifyServerTabSwitch;
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