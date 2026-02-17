// Level 2: Visual Drag & Drop (3 ordered questions, 4 minutes)
document.addEventListener('DOMContentLoaded', function(){
  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) { alert('Please start from main page'); window.location.href='../index.html'; return; }
  sessionStorage.setItem('currentLevel', '2');

  var questionContent = document.getElementById('question-content');
  var controls = document.querySelector('.controls');
  var timerController = null;
  var QUESTIONS = [];
  var currentIndex = 0;
  var currentOrders = {};
  var QUESTION_COUNT = 3;
  var validationState = {};
  var draggedItemIndex = -1;
  var submitInProgress = false;
  var hasSubmitted = false;
  var submitMarkerKey = 'level2_submit_started_' + teamId;

  function hasLocalSubmitMarker(){
    return sessionStorage.getItem(submitMarkerKey) === '1';
  }

  function setLocalSubmitMarker(){
    sessionStorage.setItem(submitMarkerKey, '1');
  }

  // If submit already started earlier (reload/network race), keep participant in waiting flow.
  if (hasLocalSubmitMarker()) {
    window.EXAM_SUBMITTED = true;
    window.location.href = '../result/waiting.html';
    return;
  }

  if (window.ER && window.ER.enableFullExamProtections) window.ER.enableFullExamProtections();
  if (window.ER && window.ER.detectFullScreenExit) window.ER.detectFullScreenExit();

  function shuffle(arr){ return arr.slice().sort(function(){ return Math.random() - 0.5; }); }
  function norm(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function seqFromAnswer(arr){
    if (Array.isArray(arr)) return arr.map(norm).filter(Boolean);
    if (typeof arr === 'string') return arr.split(',').map(norm).filter(Boolean);
    return [];
  }

  function expectedRawFromAnswer(answer){
    if (Array.isArray(answer)) return answer.map(function(v){ return String(v || '').trim(); }).filter(Boolean);
    if (typeof answer === 'string') return answer.split(',').map(function(v){ return String(v || '').trim(); }).filter(Boolean);
    return [];
  }

  function cleanItems(items){
    if (!Array.isArray(items)) return [];
    return items.map(function(v){ return String(v || '').trim(); }).filter(Boolean);
  }

  function displayItemsForQuestion(q){
    var expectedRaw = expectedRawFromAnswer(q.answer);

    var itemsRaw = cleanItems(q.items);

    // Safety: if DB item count is wrong/missing, always fallback to answer list so UI + validation stay aligned.
    var base = (itemsRaw.length === expectedRaw.length && expectedRaw.length > 0)
      ? itemsRaw
      : expectedRaw;

    // de-dup while preserving order
    var seen = {};
    var out = [];
    base.forEach(function(v){
      var key = norm(v);
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(v);
    });
    return out;
  }

  function isOrderCorrect(q, rawOrder){
    var order = Array.isArray(rawOrder) ? rawOrder.map(norm).filter(Boolean) : [];
    var expected = seqFromAnswer(q.answer);
    return order.length === expected.length && order.every(function(v, i){ return v === expected[i]; });
  }

  function persistValidation(q){
    var order = currentOrders[q._id] || [];
    validationState[q._id] = isOrderCorrect(q, order);
  }

  function moveItemInOrder(arr, fromIdx, toIdx){
    if (!Array.isArray(arr)) return [];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length || fromIdx === toIdx) return arr.slice();
    var next = arr.slice();
    var moved = next.splice(fromIdx, 1)[0];
    next.splice(toIdx, 0, moved);
    return next;
  }

  function reorderAndRender(fromIdx, toIdx){
    var q = QUESTIONS[currentIndex];
    if (!q) return;
    var order = currentOrders[q._id] || [];
    currentOrders[q._id] = moveItemInOrder(order, fromIdx, toIdx);
    persistValidation(q);
    renderQuestion();
  }

  function renderQuestion(){
    var q = QUESTIONS[currentIndex];
    if (!q) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">No Level 2 question available.</p>';
      return;
    }

    questionContent.innerHTML = '';
    var prompt = q.question || 'Arrange items in correct order and type the full names, comma-separated.';
    var promptEl = document.createElement('div');
    promptEl.className = 'question-text';
    promptEl.innerHTML = '<strong>Question ' + (currentIndex + 1) + ' / ' + QUESTIONS.length + ':</strong><br>' + prompt;
    questionContent.appendChild(promptEl);

    var display = q._displayItems || shuffle(displayItemsForQuestion(q));
    q._displayItems = display;

    if (!currentOrders[q._id] || !currentOrders[q._id].length) {
      currentOrders[q._id] = display.slice();
    }
    persistValidation(q);

    var dragHelp = document.createElement('div');
    dragHelp.style.marginTop = '10px';
    dragHelp.style.color = '#ffcf70';
    dragHelp.style.fontSize = '13px';
    dragHelp.textContent = 'Drag the boxes to arrange the correct order.';
    questionContent.appendChild(dragHelp);

    var itemsWrap = document.createElement('div');
    itemsWrap.style.display = 'flex';
    itemsWrap.style.flexWrap = 'wrap';
    itemsWrap.style.gap = '10px';
    itemsWrap.style.marginTop = '12px';
    itemsWrap.style.minHeight = '60px';

    var current = currentOrders[q._id].slice();
    current.forEach(function(it, idx){
      var d = document.createElement('div');
      d.className = 'level2-item';
      d.style.padding = '10px';
      d.style.background = '#0f3460';
      d.style.border = '1px solid #ff9f1c';
      d.style.borderRadius = '6px';
      d.style.cursor = 'grab';
      d.style.userSelect = 'none';
      d.style.minWidth = '110px';
      d.style.transition = 'transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease, opacity .2s ease';
      d.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)';
      d.setAttribute('draggable', 'true');
      d.dataset.index = String(idx);
      d.style.touchAction = 'none';

      var orderTag = document.createElement('span');
      orderTag.textContent = '#' + (idx + 1);
      orderTag.style.display = 'inline-block';
      orderTag.style.minWidth = '26px';
      orderTag.style.marginRight = '8px';
      orderTag.style.padding = '2px 6px';
      orderTag.style.borderRadius = '999px';
      orderTag.style.background = 'rgba(255,159,28,0.18)';
      orderTag.style.border = '1px solid rgba(255,159,28,0.42)';
      orderTag.style.color = '#ffcf70';
      orderTag.style.fontSize = '12px';

      var text = document.createElement('span');
      text.textContent = it;
      d.appendChild(orderTag);
      d.appendChild(text);

      d.addEventListener('dragstart', function(){
        draggedItemIndex = idx;
        d.style.opacity = '0.45';
        d.style.transform = 'scale(1.05)';
        d.style.boxShadow = '0 8px 20px rgba(0,0,0,0.35)';
      });
      d.addEventListener('dragend', function(){
        draggedItemIndex = -1;
        d.style.opacity = '1';
        d.style.transform = 'scale(1)';
        d.style.boxShadow = '0 4px 14px rgba(0,0,0,0.2)';
      });
      d.addEventListener('dragover', function(e){
        e.preventDefault();
        d.style.transform = 'translateY(-2px)';
      });
      d.addEventListener('dragleave', function(){
        d.style.transform = 'scale(1)';
      });
      d.addEventListener('drop', function(e){
        e.preventDefault();
        d.style.transform = 'scale(1)';
        var dropIndex = Number(d.dataset.index);
        reorderAndRender(draggedItemIndex, dropIndex);
      });

      // Touch support for mobile drag
      (function(el, elIdx){
        var touchStartY = 0;
        var touchStartX = 0;

        el.addEventListener('touchstart', function(e){
          e.preventDefault();
          var touch = e.touches[0];
          touchStartX = touch.clientX;
          touchStartY = touch.clientY;
          draggedItemIndex = elIdx;
          el.style.opacity = '0.45';
          el.style.transform = 'scale(1.05)';
          el.style.zIndex = '999';
          el.style.position = 'relative';
        }, { passive: false });

        el.addEventListener('touchmove', function(e){
          e.preventDefault();
          if (draggedItemIndex < 0) return;
          var touch = e.touches[0];
          var dx = touch.clientX - touchStartX;
          var dy = touch.clientY - touchStartY;
          el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(1.05)';
        }, { passive: false });

        el.addEventListener('touchend', function(e){
          if (draggedItemIndex < 0) return;
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.zIndex = '';
          el.style.position = '';

          var touch = e.changedTouches[0];
          el.style.display = 'none';
          var target = document.elementFromPoint(touch.clientX, touch.clientY);
          el.style.display = '';

          if (target) {
            var targetItem = target.closest('.level2-item');
            if (targetItem && targetItem.dataset.index !== undefined) {
              var dropIdx = Number(targetItem.dataset.index);
              var fromIdx = draggedItemIndex;
              draggedItemIndex = -1;
              reorderAndRender(fromIdx, dropIdx);
              return;
            }
          }
          draggedItemIndex = -1;
        });
      })(d, idx);

      itemsWrap.appendChild(d);
    });
    questionContent.appendChild(itemsWrap);

    renderControls();
  }

  function renderControls(){
    controls.innerHTML = '';
    var q = QUESTIONS[currentIndex];
    var isLast = currentIndex === QUESTIONS.length - 1;

    var btn = document.createElement('button');
    btn.className = isLast ? 'btn-submit' : 'btn-next';
    btn.textContent = isLast ? 'Submit Level 2' : ('Next (' + (currentIndex + 1) + '/' + QUESTIONS.length + ') →');
    // As requested: allow participant to continue with any arranged order.
    btn.disabled = false;
    btn.addEventListener('click', function(){
      if (!isLast) {
        currentIndex++;
        renderQuestion();
        return;
      }
      submitAll();
    });
    controls.appendChild(btn);
  }

  function submitAll(){
    if (submitInProgress || hasSubmitted) return;

    var allCorrect = true;
    var score = 0;

    QUESTIONS.forEach(function(q){
      var user = currentOrders[q._id] || [];
      var expected = seqFromAnswer(q.answer);
      if (expected.length < 2) {
        allCorrect = false;
        return;
      }
      var ok = isOrderCorrect(q, user);
      if (!ok) allCorrect = false;
      if (ok) score += Number(q.marks || 20);
    });

    submitInProgress = true;
    window.EXAM_SUBMITTED = true;
    hasSubmitted = true;
    setLocalSubmitMarker();
    if (timerController && timerController.stop) timerController.stop();
    if (window.ER && window.ER.disableAllInputs) window.ER.disableAllInputs();

    if (!allCorrect) {
      console.warn('Level 2 submission had unresolved ordering mismatch; sending score for admin review flow.');
    }

    API.submitScore(teamId, 2, score).then(function(resp){
      if (!resp || resp.success !== true) {
        console.warn('Level 2 submit response was non-success, moving to waiting as fail-safe:', resp);
      }
      
      // Show modal instead of alert
      var levelScore = resp.levelScore || score;
      var nextLevel = resp.nextLevel || 3;
      var title = "Level 2 Complete! 🎉";
      var message = `Congratulations! You scored ${levelScore} marks.\n\nAdvancing to Level ${nextLevel}...`;
      var redirectUrl = `level${nextLevel}.html`;
      
      showModal(title, message, redirectUrl);
      
    }).catch(function(err){
      console.warn('Level 2 submit failed, moving to waiting as fail-safe:', err);
      showModal('Error', 'Failed to submit score. Please try again.', '../result/waiting.html');
    });
  }

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

  function handleLevelTimeout(){
    if (window.EXAM_SUBMITTED || submitInProgress || hasSubmitted || hasLocalSubmitMarker()) return false;
    window.EXAM_SUBMITTED = true;
    if (window.ER && window.ER.disableAllInputs) window.ER.disableAllInputs();

    API.getTeam(teamId).then(function(team){
      // Race-safe: if submit already persisted, do NOT eliminate; continue to waiting.
      if (window.EXAM_SUBMITTED || submitInProgress || hasSubmitted || hasLocalSubmitMarker() || (team && team.level2_submitted)) {
        window.location.href = '../result/waiting.html';
        return;
      }
      notifyServerElimination('timeout').finally(function(){ window.location.href='../result/eliminated.html'; });
    }).catch(function(){
      // On network uncertainty at timeout, avoid unfair elimination and keep admin-decision flow.
      window.location.href='../result/waiting.html';
    });

    // handled here; skip extra forced actions in common timer
    return false;
  }

  // start server-synced timer (4 minutes)
  var fallbackDuration = 240;
  API.getLevelStart(2).then(function(info){
    var duration = Number(info.duration) || fallbackDuration;
    var startKey = 'timer_start_' + teamId + '_L2';
    var durationKey = 'timer_duration_' + teamId + '_L2';
    var startTs = Number(sessionStorage.getItem(startKey) || 0);
    var storedDuration = Number(sessionStorage.getItem(durationKey) || 0);
    if (!startTs || storedDuration !== duration) {
      startTs = Date.now();
      sessionStorage.setItem(startKey, String(startTs));
      sessionStorage.setItem(durationKey, String(duration));
    }
    var elapsed = Math.floor((Date.now() - startTs) / 1000);
    var remaining = Math.max(0, duration - elapsed);
    if (window.ER && window.ER.initLevelTimer) timerController = ER.initLevelTimer(remaining, '#timer-count', handleLevelTimeout);
  }).catch(function(){
    if (window.ER && window.ER.initLevelTimer) timerController = ER.initLevelTimer(fallbackDuration, '#timer-count', handleLevelTimeout);
  });

  API.fetchQuestions(2).then(function(list){
    if (!Array.isArray(list) || !list.length) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">Level 2 questions not found in MongoDB dataset.</p>';
      return;
    }

    var usable = list.filter(function(q){
      var expected = seqFromAnswer(q.answer);
      var display = displayItemsForQuestion(q);
      return expected.length >= 2 && display.length === expected.length;
    });
    if (!usable.length) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">No valid ordered-answer questions found for Level 2.</p>';
      return;
    }

    var idsKey = 'level2_question_ids_' + teamId;
    var storedIds = [];
    try { storedIds = JSON.parse(sessionStorage.getItem(idsKey) || '[]'); } catch (_) { storedIds = []; }

    if (Array.isArray(storedIds) && storedIds.length) {
      QUESTIONS = storedIds.map(function(id){ return usable.find(function(q){ return String(q._id) === String(id); }); }).filter(Boolean);
    }

    var targetCount = Math.min(QUESTION_COUNT, usable.length);
    if (QUESTIONS.length !== targetCount) {
      QUESTIONS = shuffle(usable).slice(0, Math.min(QUESTION_COUNT, usable.length));
      sessionStorage.setItem(idsKey, JSON.stringify(QUESTIONS.map(function(q){ return q._id; })));
    }

    renderQuestion();
  }).catch(function(){
    questionContent.innerHTML = '<p style="color:#ff6b6b;">Error loading level</p>';
  });

});
















