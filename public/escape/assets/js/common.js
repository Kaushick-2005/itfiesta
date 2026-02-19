/* Common JavaScript functions for NPTEL-style Proctored Exam
   Features: Full-screen enforcement, tab-switch detection, back-navigation lock, timer
   
   LOGOUT/LOGIN TAB SWITCH DETECTION:
   - When user navigates away (logout), timestamp is persisted to localStorage
   - On page load (login), system checks for previous tab leave timestamp
   - If found for same team, penalty is applied for the logout/login duration
   - This ensures users cannot bypass detection by logging out and back in
   
   ULTRA-STRICT SCREENSHOT PROTECTION:
   - Blocks Print Screen (Windows/Linux) with alerts
   - Blocks Cmd+Shift+3/4/5/6 (macOS screenshot shortcuts)
   - Blocks Win+Shift+S (Windows Snip & Sketch)
   - Blocks F12 and all DevTools shortcuts (Ctrl+Shift+I/J/C)
   - Blocks Ctrl+U (View Source) and Ctrl+P (Print)
   - Prevents screen capture APIs and recording
   - Mobile screenshot detection for Android/iOS
   - HTML2Canvas and similar libraries blocked
   - All attempts logged and alerted
   
   ULTRA-STRICT COPY PROTECTION:
   - CSS-based text selection disabled (user-select: none)
   - Mobile touch-callout disabled
   - Right-click context menu completely blocked
   - Mobile long-press selection disabled
   - All copy shortcuts blocked (Ctrl+C, Cmd+C, etc.)
   - Cut shortcuts blocked (Ctrl+X, Cmd+X)
   - Select-all blocked (Ctrl+A, Cmd+A)
   - Drag selection prevented
   - Mouse double-click selection blocked
   - Copy/cut events intercepted with clipboard clearing
   - Aggressive 1-second periodic clipboard clearing
   - Mobile selectionchange monitoring
   - Drag-and-drop completely disabled
   - Input fields remain functional for answers
   - Visual watermark overlay with team ID and timestamp
   
   ALL PROTECTIONS AUTO-ENABLED via enableFullExamProtections()
*/

// Global flag to disable anti-cheat after submission
window.EXAM_SUBMITTED = false;
var escapeHeartbeatTimer = null;
var ESCAPE_HEARTBEAT_INTERVAL_MS = 4000;
var ESCAPE_PENDING_ALERT_KEY = 'escape_pending_alert_message';
var ESCAPE_TAB_LEAVE_TIMESTAMP_KEY = 'escape_tab_leave_timestamp';
var ESCAPE_TAB_LEAVE_TEAM_KEY = 'escape_tab_leave_team';
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
  if (window.EXAM_SUBMITTED) {
    // Clear localStorage on exam submission to avoid false penalties
    try {
      localStorage.removeItem(ESCAPE_TAB_LEAVE_TIMESTAMP_KEY);
      localStorage.removeItem(ESCAPE_TAB_LEAVE_TEAM_KEY);
    } catch (_) {}
    return;
  }
  
  if (tabSwitchCooldown) return;
  
  var now = Date.now();
  // Improved validation to reduce false positives
  var isLikelyUserAction = !reason.includes('blur') || (reason.includes('delayed') && now - (detectionState.lastDetectionTime || 0) > 3000);
  
  if (!detectionState.isHidden && isLikelyUserAction) {
    detectionState.isHidden = true;
    detectionState.hideStartTime = now;
    tabLeaveStartedAt = now;
    tabLeaveReason = String(reason || 'unknown');
    
    // Persist to localStorage for logout/login detection
    try {
      var teamId = sessionStorage.getItem('teamId');
      if (teamId) {
        localStorage.setItem(ESCAPE_TAB_LEAVE_TIMESTAMP_KEY, String(now));
        localStorage.setItem(ESCAPE_TAB_LEAVE_TEAM_KEY, teamId);
        console.log('[TabDetect] Persisted tab leave timestamp for logout/login tracking');
      }
    } catch (_) {}
    
    console.log('[TabDetect] Page hidden:', reason, 'at', new Date(now).toISOString());
  }
}

function handlePotentialTabReturn(source) {
  if (window.EXAM_SUBMITTED || tabSwitchCooldown || !detectionState.isHidden) return;

  var now = Date.now();
  var hiddenDuration = now - detectionState.hideStartTime;
  
  // Clear localStorage timestamp
  try {
    localStorage.removeItem(ESCAPE_TAB_LEAVE_TIMESTAMP_KEY);
    localStorage.removeItem(ESCAPE_TAB_LEAVE_TEAM_KEY);
  } catch (_) {}
  
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

  // Filter permission dialogs and system alerts (very brief interruptions)
  if (hiddenMs < 500) {
    console.log('[TabDetect] Filtering very brief interruption (permission dialog?):', hiddenMs, 'ms');
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

  // MOBILE DETECTION: Filter permission dialogs and system alerts
  if (browserInfo.isMobile) {
    // Filter permission dialogs (location, camera, notifications, etc.)
    if (hiddenMs < 800) {
      console.log('[TabDetect] Filtering mobile permission dialog or brief UI:', hiddenMs, 'ms');
      return false; // Permission dialogs cause brief visibility changes
    }
    
    // Filter very brief mobile browser UI interactions
    if (hiddenMs < 1500 && source.includes('blur') && !source.includes('delayed')) {
      return false; // Filter immediate mobile blur events
    }
    
    // iOS Safari: Filter permission dialogs and system alerts
    if (browserInfo.isIOS && hiddenMs < 2000 && source.includes('pagehide')) {
      console.log('[TabDetect] Filtering iOS brief interruption:', hiddenMs, 'ms');
      return false; // iOS Safari pagehide filtering for alerts/permissions
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

// Check for logout/login tab switch on page load
function checkLogoutLoginTabSwitch() {
  try {
    var tabLeaveTimestamp = localStorage.getItem(ESCAPE_TAB_LEAVE_TIMESTAMP_KEY);
    var tabLeaveTeamId = localStorage.getItem(ESCAPE_TAB_LEAVE_TEAM_KEY);
    var currentTeamId = sessionStorage.getItem('teamId');
    
    console.log('[TabDetect] Checking for previous tab leave...');
    console.log('[TabDetect] Previous team:', tabLeaveTeamId, '| Current team:', currentTeamId);
    
    // CRITICAL: Always clear localStorage entries to prevent cross-user contamination
    // This must happen BEFORE any penalty logic to ensure clean state for each login
    var shouldApplyPenalty = false;
    var hiddenDuration = 0;
    
    if (tabLeaveTimestamp && tabLeaveTeamId && currentTeamId) {
      // Check if this is the SAME team returning (not a different user)
      if (tabLeaveTeamId === currentTeamId) {
        var now = Date.now();
        var leaveTime = parseInt(tabLeaveTimestamp, 10);
        hiddenDuration = now - leaveTime;
        
        console.log('[TabDetect] SAME TEAM detected - logout/login scenario');
        console.log('[TabDetect] Tab was left at:', new Date(leaveTime).toISOString());
        console.log('[TabDetect] Return detected at:', new Date(now).toISOString());
        console.log('[TabDetect] Hidden duration:', hiddenDuration + 'ms');
        
        // Apply penalty if duration is significant
        if (hiddenDuration >= ESCAPE_MIN_HIDDEN_MS_FOR_PENALTY && hiddenDuration < 600000) {
          shouldApplyPenalty = true;
        }
      } else {
        console.log('[TabDetect] DIFFERENT TEAM - clearing previous user\'s data');
        console.log('[TabDetect] Previous team:', tabLeaveTeamId, '!== Current team:', currentTeamId);
      }
    } else {
      console.log('[TabDetect] No previous tab leave detected or missing data');
    }
    
    // ALWAYS clear localStorage regardless of team match to prevent cross-contamination
    localStorage.removeItem(ESCAPE_TAB_LEAVE_TIMESTAMP_KEY);
    localStorage.removeItem(ESCAPE_TAB_LEAVE_TEAM_KEY);
    console.log('[TabDetect] Cleared localStorage for fresh session');
    
    // Now apply penalty only if it was the same team
    if (shouldApplyPenalty) {
      console.log('[TabDetect] Applying penalty for logout/login tab switch');
      
      // Show immediate alert
      setTimeout(function() {
        try {
          alert('TAB SWITCH DETECTED VIA LOGOUT/LOGIN!\n⏱️ Duration: ' + hiddenDuration + 'ms\n\n⏳ Processing penalty...');
        } catch (_) {}
      }, 500);
      
      // Apply penalty
      notifyServerTabSwitch(hiddenDuration).then(function(data) {
        if (data && data.action === 'penalty') {
          var penaltyMessage = data.message || 
            ('LOGOUT/LOGIN TAB SWITCH PENALTY!\n\n' +
             '❌ Score Deducted: -' + (data.scoreDeducted || 10) + ' marks\n' +
             '📊 Current Score: ' + (data.currentScore || 0) + '\n' +
             '🔢 Total Violations: ' + (data.tabSwitchCount || 1) + '\n\n' +
             '⚠️ Logging out does not excuse tab switching!');
          
          setTimeout(function() {
            try {
              alert(penaltyMessage);
            } catch (_) {}
          }, 2000);
        }
      });
    }
  } catch (e) {
    console.error('[TabDetect] Error checking logout/login tab switch:', e);
  }
}

function enableTabSwitchPenalty(){
  if (window.__ER_TAB_PENALTY_BOUND) return;
  window.__ER_TAB_PENALTY_BOUND = true;

  console.log('[TabDetect] Enhanced tab switch penalty system enabled');
  console.log('[TabDetect] Device Info:', browserInfo);
  
  // Check for logout/login tab switch detection
  checkLogoutLoginTabSwitch();
  
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
  
  // Beforeunload detection for navigation away (logout, etc.)
  window.addEventListener('beforeunload', function(e) {
    if (!window.EXAM_SUBMITTED && !detectionState.isHidden) {
      markPotentialTabLeave('beforeunload_navigation');
      console.log('[TabDetect] Navigation away detected (logout/close)');
    }
  });
  
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

// ==================== SCREENSHOT & COPY PROTECTION ====================
// ULTRA STRICT MODE - Blocks all possible screenshot and copy methods

// Disable screenshot functionality across all devices
function disableScreenshots() {
  if (window.__ER_SCREENSHOT_DISABLED) return;
  window.__ER_SCREENSHOT_DISABLED = true;
  
  console.log('[Security] Enabling STRICT screenshot protection');
  
  // COMPREHENSIVE keyboard shortcut blocking
  document.addEventListener('keydown', function(e) {
    var key = e.key ? e.key.toLowerCase() : '';
    var code = e.keyCode || e.which;
    var isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    // ALWAYS allow all keys in input fields for typing - exit early
    if (isInputField) {
      return;  // Don't interfere with input field interactions
    }
    
    // Print Screen (Windows/Linux) - multiple codes
    if (key === 'printscreen' || code === 44 || code === 124) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Screenshot blocked: Print Screen');
      alert('⚠️ SCREENSHOTS STRICTLY DISABLED\n\nThis action is logged. Violation may result in exam termination.');
      return false;
    }
    
    // Cmd+Shift+3/4/5/6 (macOS screenshot shortcuts - all variants)
    if (e.metaKey && e.shiftKey && ['3', '4', '5', '6'].includes(key)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Screenshot blocked: macOS shortcut Cmd+Shift+' + key);
      alert('⚠️ SCREENSHOTS STRICTLY DISABLED\n\nThis action is logged. Violation may result in exam termination.');
      return false;
    }
    
    // Windows+Shift+S (Windows Snip & Sketch)
    if (e.key === 'Meta' || (e.metaKey && e.shiftKey && key === 's')) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Screenshot blocked: Windows Snip');
      return false;
    }
    
    // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C (DevTools)
    if (code === 123 || // F12
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'i' || key === 'j' || key === 'c' || code === 73 || code === 74)) ||
        ((e.ctrlKey || e.metaKey) && key === 'u' || code === 85)) { // Ctrl+U (view source)
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] DevTools/View Source blocked');
      alert('⚠️ DEVELOPER TOOLS DISABLED\n\nAttempting to open DevTools is strictly prohibited.');
      return false;
    }
    
    // Block Ctrl+P (Print)
    if ((e.ctrlKey || e.metaKey) && (key === 'p' || code === 80)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Print blocked');
      alert('⚠️ PRINTING DISABLED\n\nPrinting is not allowed during the exam.');
      return false;
    }
    
    // Block Ctrl+S (Save)
    if ((e.ctrlKey || e.metaKey) && (key === 's' || code === 83)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Save blocked');
      return false;
    }
  }, true); // Capture phase for earliest interception
  
  // Block keyup events too (some tools capture on keyup)
  document.addEventListener('keyup', function(e) {
    if (e.key === 'PrintScreen' || e.keyCode === 44 || e.keyCode === 124) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);
  
  // STRICT Mobile screenshot detection and prevention
  if (browserInfo.isMobile) {
    console.log('[Security] Enabling mobile screenshot detection');
    
    // Android: Detect power+volume button combo
    var lastBlurTime = 0;
    window.addEventListener('blur', function() {
      lastBlurTime = Date.now();
    }, true);
    
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        var timeSinceBlur = Date.now() - lastBlurTime;
        if (timeSinceBlur < 300) {
          console.warn('[Security] Possible mobile screenshot detected');
          // Log to server if needed
          setTimeout(function() {
            if (document.visibilityState === 'visible') {
              alert('⚠️ SCREENSHOT DETECTED\n\nScreenshots are strictly prohibited during the exam.');
            }
          }, 500);
        }
      }
    }, true);
    
    // iOS: Detect screenshot via user gesture tracking
    if (browserInfo.isIOS) {
      var touchCount = 0;
      document.addEventListener('touchstart', function() {
        touchCount++;
      });
      document.addEventListener('touchend', function() {
        touchCount = 0;
      });
    }
  }
  
  // Block ALL screen capture APIs
  if (navigator.mediaDevices) {
    // Block getDisplayMedia (screen sharing/recording)
    if (navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices.getDisplayMedia = function() {
        console.warn('[Security] Screen capture API blocked');
        alert('⚠️ SCREEN RECORDING STRICTLY DISABLED\n\nScreen recording is prohibited.');
        return Promise.reject(new Error('Screen capture disabled during exam'));
      };
    }
    
    // Override getUserMedia to prevent screen capture
    var originalGetUserMedia = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = function(constraints) {
      if (constraints && constraints.video && constraints.video.mediaSource) {
        console.warn('[Security] Screen capture via getUserMedia blocked');
        alert('⚠️ SCREEN RECORDING STRICTLY DISABLED');
        return Promise.reject(new Error('Screen capture disabled'));
      }
      return originalGetUserMedia.apply(this, arguments);
    };
  }
  
  // Disable viewport screenshot (HTML2Canvas, etc.)
  if (window.html2canvas) {
    window.html2canvas = function() {
      console.warn('[Security] HTML2Canvas blocked');
      alert('⚠️ SCREENSHOT LIBRARY BLOCKED');
      return Promise.reject(new Error('Screen capture disabled during exam'));
    };
  }
}

// Disable text selection and copy functionality - ULTRA STRICT
function disableTextCopy() {
  if (window.__ER_COPY_DISABLED) return;
  window.__ER_COPY_DISABLED = true;
  
  console.log('[Security] Enabling STRICT copy protection');
  
  // COMPREHENSIVE CSS-based text selection blocking
  var style = document.createElement('style');
  style.id = 'no-select-style';
  style.textContent = `
    * {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    /* Allow interactive elements to function normally */
    input, textarea, button, select, option, label,
    [draggable="true"], [onclick],
    .option, .option-label, .option-text,
    .draggable, .level2-item, .droppable, .drop-zone,
    .answer, .drag-item,
    #level3-answer, #level4-answer, #level5-answer {
      -webkit-user-select: auto !important;
      -moz-user-select: auto !important;
      -ms-user-select: auto !important;
      user-select: auto !important;
      pointer-events: auto !important;
    }
    /* Input fields need text selection and MUST be able to receive events */
    input, textarea {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
      pointer-events: auto !important;
    }
    /* Make page content unselectable via CSS */
    ::selection {
      background: transparent !important;
      color: inherit !important;
    }
    ::-moz-selection {
      background: transparent !important;
      color: inherit !important;
    }
  `;
  document.head.appendChild(style);
  
  // Add meta tag to prevent selection on mobile
  var metaViewport = document.querySelector('meta[name="viewport"]');
  if (!metaViewport) {
    metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    metaViewport.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
    document.head.appendChild(metaViewport);
  }
  
  // Disable context menu (right-click) - SILENT (no annoying alerts)
  document.addEventListener('contextmenu', function(e) {
    // Allow context menu on input fields for spell check, etc.
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    e.preventDefault();
    console.warn('[Security] Right-click disabled');
    // No alert - just prevent the menu silently
    return false;
  }, false);
  
  // Long press detection for mobile (alternative to right-click)
  if (browserInfo.isMobile) {
    var longPressTimer;
    document.addEventListener('touchstart', function(e) {
      longPressTimer = setTimeout(function() {
        e.preventDefault();
        e.stopPropagation();
      }, 500);
    }, true);
    document.addEventListener('touchend', function() {
      clearTimeout(longPressTimer);
    }, true);
    document.addEventListener('touchmove', function() {
      clearTimeout(longPressTimer);
    }, true);
  }
  
  // COMPREHENSIVE keyboard shortcut blocking
  document.addEventListener('keydown', function(e) {
    var key = e.key ? e.key.toLowerCase() : '';
    var code = e.keyCode || e.which;
    var isInputField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
    
    // ALWAYS allow typing in input fields - exit early for all non-modifier keys
    if (isInputField && !e.ctrlKey && !e.metaKey && !e.altKey) {
      return;  // Allow normal typing
    }
    
    // Ctrl+C or Cmd+C (Copy)
    if ((e.ctrlKey || e.metaKey) && (key === 'c' || code === 67)) {
      if (isInputField) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Copy blocked');
      alert('⚠️ COPYING STRICTLY DISABLED\n\nText copying is not allowed.');
      return false;
    }
    
    // Ctrl+X or Cmd+X (Cut)
    if ((e.ctrlKey || e.metaKey) && (key === 'x' || code === 88)) {
      if (isInputField) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Cut blocked');
      return false;
    }
    
    // Ctrl+A or Cmd+A (Select All)
    if ((e.ctrlKey || e.metaKey) && (key === 'a' || code === 65)) {
      if (isInputField) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      console.warn('[Security] Select all blocked');
      return false;
    }
    
    // Ctrl+V (Paste) - block from external sources
    if ((e.ctrlKey || e.metaKey) && (key === 'v' || code === 86)) {
      // Allow paste in input fields but monitor clipboard
      if (!isInputField) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    }
    
    // Block Ctrl+Shift+V (paste without formatting)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === 'v' || code === 86)) {
      if (!isInputField) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);
  
  // Intercept ALL copy events and aggressively clear clipboard
  document.addEventListener('copy', function(e) {
    // Allow copy from input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    // Aggressively clear clipboard data
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', '');
      e.clipboardData.setData('text/html', '');
      e.clipboardData.setData('text/uri-list', '');
      e.clipboardData.setData('text/csv', '');
      e.clipboardData.setData('application/json', '');
    }
    
    // Alternative method: clear system clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(function() {});
      }
    } catch (_) {}
    
    console.warn('[Security] Copy blocked and clipboard cleared');
    alert('⚠️ COPYING STRICTLY DISABLED\n\nText copying is not allowed during the exam.\nThis action has been logged.');
    return false;
  }, true);
  
  // Intercept cut events
  document.addEventListener('cut', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return true;
    }
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    if (e.clipboardData) {
      e.clipboardData.setData('text/plain', '');
      e.clipboardData.setData('text/html', '');
    }
    
    console.warn('[Security] Cut blocked and clipboard cleared');
    return false;
  }, true);
  
  // Intercept paste events (monitor what's being pasted)
  document.addEventListener('paste', function(e) {
    console.log('[Security] Paste event detected');
    // Allow paste in input fields but log it
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      console.log('[Security] Paste allowed in input field');
      return true;
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);
  
  // AGGRESSIVE periodic clipboard clearing
  var clipboardClearInterval = setInterval(function() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText('').catch(function() {});
      }
    } catch (_) {}
  }, 1000); // Clear every 1 second (more aggressive)
  
  // Store interval ID for potential cleanup
  window.__ER_CLIPBOARD_CLEAR_INTERVAL = clipboardClearInterval;
  
  // Disable text selection via multiple methods
  document.addEventListener('selectstart', function(e) {
    // ALLOW selection in input fields, textareas, and contenteditable
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable) {
      return true;  // Allow selection
    }
    // Allow selection in exam interactive elements
    if (e.target.closest('label') || 
        e.target.closest('button') ||
        e.target.closest('.option')) {
      return true;  // Allow for quiz interactions
    }
    // Block text selection on static content
    e.preventDefault();
    return false;
  }, false);
  
  // Allow normal clicking on interactive elements
  document.addEventListener('mousedown', function(e) {
    // ALLOW clicks on ALL interactive elements for exam functionality
    if (e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'BUTTON' ||
        e.target.tagName === 'SELECT' ||
        e.target.tagName === 'LABEL' ||  // For radio/checkbox labels
        e.target.tagName === 'OPTION' ||
        e.target.tagName === 'A' ||      // Links
        e.target.getAttribute('draggable') || // Draggable items
        e.target.dataset.option ||       // Answer options
        e.target.dataset.draggable ||    // Drag elements
        e.target.classList.contains('draggable') ||
        e.target.classList.contains('option') ||
        e.target.classList.contains('answer') ||
        e.target.classList.contains('droppable') ||
        e.target.classList.contains('drop-zone') ||
        e.target.classList.contains('level2-item') ||
        e.target.classList.contains('option-label') ||
        e.target.classList.contains('option-text') ||
        e.target.onclick ||
        e.target.closest('button') ||
        e.target.closest('label') ||     // Clicks inside labels
        e.target.closest('[onclick]') || // Any element with onclick
        e.target.closest('[draggable]') || // Draggable containers
        e.target.closest('.option') ||   // Answer option containers
        e.target.closest('.option-label') ||   // Level 1 option labels
        e.target.closest('.draggable') ||
        e.target.closest('.level2-item') ||
        e.target.closest('.droppable')) {
      return;  // Don't interfere - allow normal behavior
    }
    // Only prevent text selection on double-click for non-interactive content
    if (e.detail > 1) {
      e.preventDefault();
    }
  }, false);
  
  // Allow drag and drop for exam elements ONLY
  document.addEventListener('dragstart', function(e) {
    // ALLOW drag for exam elements (Level 2 drag-and-drop questions)
    if (e.target.getAttribute('draggable') === 'true' ||
        e.target.dataset.draggable ||
        e.target.classList.contains('draggable') ||
        e.target.classList.contains('drag-item') ||
        e.target.classList.contains('level2-item') ||  // Level 2 specific
        e.target.closest('[draggable="true"]') ||
        e.target.closest('.draggable') ||
        e.target.closest('.level2-item')) {
      console.log('[Security] Allowing drag for exam element');
      return;  // Allow exam drag-and-drop - don't interfere
    }
    // Block dragging of other content
    e.preventDefault();
    return false;
  }, false);
  
  document.addEventListener('drop', function(e) {
    // ALLOW drop for exam elements
    if (e.target.classList.contains('droppable') ||
        e.target.classList.contains('drop-zone') ||
        e.target.classList.contains('level2-item') ||  // Level 2 items are drop targets
        e.target.dataset.droppable ||
        e.target.closest('.droppable') ||
        e.target.closest('.drop-zone') ||
        e.target.closest('.level2-item')) {
      console.log('[Security] Allowing drop for exam element');
      // Don't call preventDefault here - let the exam handlers process it
      return;  // Allow exam drag-and-drop - don't interfere
    }
    // Block dropping elsewhere
    e.preventDefault();
    return false;
  }, false);
  
  document.addEventListener('dragover', function(e) {
    // ALLOW dragover for exam drop zones
    if (e.target.classList.contains('droppable') ||
        e.target.classList.contains('drop-zone') ||
        e.target.classList.contains('level2-item') ||  // Level 2 items accept dragover
        e.target.dataset.droppable ||
        e.target.closest('.droppable') ||
        e.target.closest('.drop-zone') ||
        e.target.closest('.level2-item')) {
      // Let the exam's own handler manage preventDefault
      return;  // Allow exam drag-and-drop - don't interfere
    }
    e.preventDefault();
    return false;
  }, false);
  
  // Disable selection in mobile browsers
  if (browserInfo.isMobile) {
    document.addEventListener('selectionchange', function() {
      var selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        var range = selection.getRangeAt(0);
        var container = range.commonAncestorContainer;
        var element = container.nodeType === 1 ? container : container.parentElement;
        
        // Clear selection if not in input field
        if (element && element.tagName !== 'INPUT' && element.tagName !== 'TEXTAREA') {
          selection.removeAllRanges();
          console.warn('[Security] Mobile text selection cleared');
        }
      }
    });
  }
  
  console.log('[Security] STRICT copy protection fully enabled');
}

// Add visual watermark to discourage screenshots
function addSecurityWatermark() {
  if (window.__ER_WATERMARK_ADDED) return;
  window.__ER_WATERMARK_ADDED = true;
  
  var teamId = sessionStorage.getItem('teamId') || 'UNKNOWN';
  var timestamp = new Date().toLocaleString();
  
  // Create watermark overlay
  var watermark = document.createElement('div');
  watermark.id = 'security-watermark';
  watermark.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999999;
    opacity: 0.03;
    background-image: repeating-linear-gradient(
      45deg,
      transparent,
      transparent 100px,
      rgba(0,0,0,0.02) 100px,
      rgba(0,0,0,0.02) 200px
    );
  `;
  
  // Add team ID and timestamp text
  var watermarkText = document.createElement('div');
  watermarkText.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-45deg);
    font-size: 48px;
    color: rgba(0,0,0,0.05);
    font-weight: bold;
    white-space: nowrap;
    letter-spacing: 10px;
    user-select: none;
  `;
  watermarkText.textContent = teamId + ' • ' + timestamp;
  watermark.appendChild(watermarkText);
  
  document.body.appendChild(watermark);
  console.log('[Security] Watermark added');
}

// Auto-enable all anti-cheat protections
function enableFullExamProtections() {
  enableTabSwitchPenalty();
  preventBackNavigation();
  enableBeforeUnloadWarning();
  disableScreenshots();
  disableTextCopy();
  addSecurityWatermark();
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
window.ER.disableScreenshots = disableScreenshots;
window.ER.disableTextCopy = disableTextCopy;
window.ER.addSecurityWatermark = addSecurityWatermark;
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