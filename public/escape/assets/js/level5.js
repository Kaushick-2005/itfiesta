// Level 5: Coding Final — vertical -> horizontal scroll sync
document.addEventListener('DOMContentLoaded', function(){
  if (window.ER && window.ER.enableFullExamProtections) window.ER.enableFullExamProtections();
  if (window.ER && window.ER.detectFullScreenExit) window.ER.detectFullScreenExit();

  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) { alert('Please start from main page'); window.location.href='../index.html'; return; }
  sessionStorage.setItem('currentLevel', '5');

  var starterEl = document.getElementById('starter-html');
  var cssEl = document.getElementById('user-css');
  var jsEl = document.getElementById('user-js');
  var preview = document.getElementById('preview');
  var runBtn = document.getElementById('runBtn');
  var testBtn = document.getElementById('testBtn');
  var status = document.getElementById('status');
  var timerController = null;

  // 10-minute timer with session persistence and server-synced duration
  API.getLevelDefinition(5).then(function(def){
    var fallbackDuration = Number(def && def.durationSeconds) || 600;
    return API.getLevelStart(5).then(function(info){
      var duration = Number(info.duration) || fallbackDuration;
      var startKey = 'timer_start_' + teamId + '_L5';
      var durationKey = 'timer_duration_' + teamId + '_L5';
      var startTs = Number(sessionStorage.getItem(startKey) || 0);
      var storedDuration = Number(sessionStorage.getItem(durationKey) || 0);
      if (!startTs || storedDuration !== duration) {
        startTs = Date.now();
        sessionStorage.setItem(startKey, String(startTs));
        sessionStorage.setItem(durationKey, String(duration));
      }
      var elapsed = Math.floor((Date.now() - startTs) / 1000);
      var remaining = Math.max(0, duration - elapsed);
      if (window.ER && window.ER.initLevelTimer) {
        timerController = ER.initLevelTimer(remaining, '#timer-count', function(){
          window.EXAM_SUBMITTED = true;
          notifyServerElimination('timeout').finally(function(){ window.location.href='../result/eliminated.html'; });
        });
      }
    }).catch(function(){
      if (window.ER && window.ER.initLevelTimer) {
        timerController = ER.initLevelTimer(fallbackDuration, '#timer-count', function(){
          window.EXAM_SUBMITTED = true;
          notifyServerElimination('timeout').finally(function(){ window.location.href='../result/eliminated.html'; });
        });
      }
    });
  }).catch(function(){
    if (window.ER && window.ER.initLevelTimer) {
      timerController = ER.initLevelTimer(600, '#timer-count', function(){
        window.EXAM_SUBMITTED = true;
        notifyServerElimination('timeout').finally(function(){ window.location.href='../result/eliminated.html'; });
      });
    }
  });

  // Load level definition (starter template provided by admin). If not present, use default template.
  API.getLevelDefinition(5).then(function(def){
    var html = def && def.prompt ? def.prompt : defaultStarter();
    starterEl.value = html;
    // load into preview initially
    setPreview(html, '', '');
  }).catch(function(){ starterEl.value = defaultStarter(); setPreview(starterEl.value,'',''); });

  function defaultStarter(){
    return `<!doctype html><html><head><meta charset="utf-8"><title>Starter</title><style>
    body{margin:0;font-family:sans-serif}
    .vwrap{height:100vh;overflow-y:scroll}
    .spacer{height:200vh;background:linear-gradient(#fff,#ddd)}
    .hwrap{white-space:nowrap;overflow-x:auto;height:300px}
    .item{display:inline-block;width:300px;height:280px;margin:8px;background:#1f8fff;color:#fff;line-height:280px;text-align:center}
    </style></head><body>
    <div class="vwrap" id="vertical-scroll">
      <div class="spacer">Scroll vertically to move carousel</div>
    </div>
    <div class="hwrap" id="horizontal-scroll">
      <div class="item">One</div><div class="item">Two</div><div class="item">Three</div><div class="item">Four</div><div class="item">Five</div>
    </div>
    </body></html>`;
  }

  function setPreview(html, css, js){
    // build srcdoc with injected CSS/JS
    var injected = html;
    // inject CSS into head
    injected = injected.replace('</head>', `<style id="__user_css">${css}</style></head>`);
    // inject JS before closing body
    injected = injected.replace('</body>', `<script id="__user_js">(function(){try{${js}\n}catch(e){console.error(e)}})();</script></body>`);
    preview.srcdoc = injected;
  }

  runBtn.addEventListener('click', function(){
    setPreview(starterEl.value, cssEl.value, jsEl.value);
    status.textContent = 'Preview updated.';
  });

  // Automated test: checks proportional mapping of vertical scroll -> horizontal scroll
  testBtn.addEventListener('click', function(){
    status.textContent = 'Running tests...';
    setPreview(starterEl.value, cssEl.value, jsEl.value);
    // give iframe time to load
    setTimeout(function(){ runTestsInPreview().then(function(success){
      if (success) {
        status.textContent = 'Tests passed — submitting result to server...';
        // Submit PASSED token; backend accepts this when admin sets correctAnswer='__auto__'
        window.EXAM_SUBMITTED = true;
        if (timerController && timerController.stop) timerController.stop();
        API.submitLevelAnswer(5, teamId, 'PASSED').then(function(res){
          if (res && res.result === 'correct') {
            status.textContent = 'Success — submitted. Redirecting...';
            // Show modal instead of alert
            var levelScore = res.levelScore || 50;
            var title = "Level 5 Complete! 🎆";
            var message = `Congratulations! You scored ${levelScore} marks.\n\nYou have completed all levels!`;
            showModal(title, message, '../result/winner.html');
          } else {
            status.textContent = 'Server did not accept the submission: ' + JSON.stringify(res || {});
          }
        }).catch(function(err){ status.textContent = 'Submission failed: '+err; });
      } else {
        status.textContent = 'Tests failed. Please fix your code and try again.';
      }
    }).catch(function(err){ status.textContent = 'Test error: '+err; }); }, 350);
  });

  // Modal function
  function showModal(title, message, redirectUrl) {
    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalMessage").innerText = message;
    
    const modal = document.getElementById("resultModal");
    modal.style.display = "flex";
    
    // Ensure Continue button is enabled and clickable
    var confirmBtn = document.getElementById("confirmBtn");
    confirmBtn.removeAttribute('disabled');
    confirmBtn.classList.remove('disabled');
    confirmBtn.style.pointerEvents = 'auto';
    
    confirmBtn.onclick = function() {
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        modal.style.display = "none";
      }
    };
  }

  function runTestsInPreview(){
    return new Promise(function(resolve, reject){
      var ifr = preview.contentWindow;
      if (!ifr) return reject('Preview not ready');

      try {
        // must access elements by expected IDs
        var v = ifr.document.getElementById('vertical-scroll');
        var h = ifr.document.getElementById('horizontal-scroll');
        if (!v || !h) return resolve(false);

        var maxV = v.scrollHeight - v.clientHeight;
        var maxH = h.scrollWidth - h.clientWidth;
        if (maxV <= 0 || maxH <= 0) return resolve(false);

        var positions = [0, 0.25, 0.5, 0.75, 1];
        var tolerance = 0.08; // 8% tolerance
        var i = 0;

        function checkNext(){
          if (i >= positions.length) return resolve(true);
          var p = positions[i++];
          v.scrollTop = Math.round(maxV * p);
          // allow scroll to take effect
          setTimeout(function(){
            var actualH = h.scrollLeft;
            var expectedH = Math.round(maxH * p);
            var diff = Math.abs(actualH - expectedH);
            var allowed = Math.max(1, Math.round(maxH * tolerance));
            if (diff > allowed) return resolve(false);
            checkNext();
          }, 120);
        }

        checkNext();
      } catch (e) {
        return reject(e.message || e);
      }
    });
  }

});
