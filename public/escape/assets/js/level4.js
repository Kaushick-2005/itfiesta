// Level 4: Multi-Constraint Tech Crisis Final (DB-driven ordered actions)
document.addEventListener('DOMContentLoaded', function(){
  if (window.ER && window.ER.enableFullExamProtections) window.ER.enableFullExamProtections();
  if (window.ER && window.ER.detectFullScreenExit) window.ER.detectFullScreenExit();

  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) { alert('Please start from main page'); window.location.href='../index.html'; return; }
  sessionStorage.setItem('currentLevel', '4');

  var questionContent = document.getElementById('question-content');
  var controls = document.querySelector('.controls');
  var timerController = null;
  var QUESTION_COUNT = 3;
  var QUESTIONS = [];
  var currentIndex = 0;
  var selections = {};
  var submitInProgress = false;
  var hasSubmitted = false;

  function shuffle(arr){ return arr.slice().sort(function(){ return Math.random() - 0.5; }); }

  function scoreQuestion(q, selectedIndices){
    var userOrder = Array.isArray(selectedIndices) ? selectedIndices.map(function(i){ return Number(i) + 1; }) : [];
    var expected = Array.isArray(q.correct_order) ? q.correct_order.map(function(v){ return Number(v); }) : [];
    if (userOrder.length !== expected.length) return 0;
    for (var i = 0; i < expected.length; i++) {
      if (userOrder[i] !== expected[i]) return 0;
    }
    return Number(q.marks || 20);
  }

  function submitAll(){
    if (submitInProgress || hasSubmitted) return;
    submitInProgress = true;
    hasSubmitted = true;
    window.EXAM_SUBMITTED = true;
    if (timerController && timerController.stop) timerController.stop();
    if (window.ER && window.ER.disableAllInputs) window.ER.disableAllInputs();

    var score = 0;
    QUESTIONS.forEach(function(q){
      score += scoreQuestion(q, selections[q._id]);
    });

    API.submitScore(teamId, 4, score).then(function(resp){
      // Show modal instead of alert
      var levelScore = resp.levelScore || score;
      var nextLevel = resp.nextLevel || 5;
      var title = "Level 4 Complete! 🎉";
      var message = `Congratulations! You scored ${levelScore} marks.\n\nAdvancing to Level ${nextLevel}...`;
      var redirectUrl = `level${nextLevel}.html`;
      
      showModal(title, message, redirectUrl);
      
    }).catch(function(){
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

  function renderQuestion(){
    var q = QUESTIONS[currentIndex];
    if (!q) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">No Level 4 question available.</p>';
      return;
    }

    var scenario = q.scenario || 'Tech Crisis Scenario';
    var incident = q.incident || '';
    var constraints = Array.isArray(q.constraints) ? q.constraints : [];
    var instruction = q.instruction || 'Arrange actions in execution order.';
    var actions = Array.isArray(q.actions) ? q.actions.slice() : [];
    var requiredCount = Number(Array.isArray(q.correct_order) ? q.correct_order.length : 0) || 4;

    if (!actions.length) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">No actions found for this question.</p>';
      return;
    }

    questionContent.innerHTML = '';
    var scenEl = document.createElement('div');
    scenEl.className='question-text';
    scenEl.innerHTML = '<strong>Question ' + (currentIndex + 1) + ' / ' + QUESTIONS.length + ':</strong> '
      + scenario
      + (incident ? ('<br><strong>Incident:</strong> ' + incident) : '')
      + (constraints.length ? ('<br><strong>Constraints:</strong><ul style="margin:8px 0 0 20px;">' + constraints.map(function(c){ return '<li>' + c + '</li>'; }).join('') + '</ul>') : '')
      + '<br><strong>Instruction:</strong> ' + instruction
      + '<br><strong>Required Actions:</strong> Select exactly ' + requiredCount + ' and arrange in order.';
    questionContent.appendChild(scenEl);

    if (!Array.isArray(selections[q._id])) selections[q._id] = [];
    var selectedIndices = selections[q._id];
    var shuffledIdx = (q._shuffledIdx && q._shuffledIdx.length === actions.length)
      ? q._shuffledIdx
      : shuffle(actions.map(function(_, idx){ return idx; }));
    q._shuffledIdx = shuffledIdx;

    var actionsWrap = document.createElement('div');
    actionsWrap.style.marginTop='12px';
    actionsWrap.style.display='flex';
    actionsWrap.style.flexWrap='wrap';
    actionsWrap.style.gap='8px';

    var selectedWrap = document.createElement('div');
    selectedWrap.style.marginTop = '12px';

    function renderSelected(){
      selectedWrap.innerHTML = '<strong>Selected Order (' + selectedIndices.length + '/' + requiredCount + ')</strong>';
      var list = document.createElement('div');
      list.style.marginTop = '8px';
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '6px';

      if (!selectedIndices.length) {
        var empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = 'No action selected yet.';
        list.appendChild(empty);
      } else {
        selectedIndices.forEach(function(ai, order){
          var row = document.createElement('div');
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.justifyContent = 'space-between';
          row.style.background = 'rgba(255,255,255,0.05)';
          row.style.padding = '8px 10px';
          row.style.borderRadius = '6px';
          row.innerHTML = '<span><strong>' + (order + 1) + '.</strong> ' + actions[ai] + '</span>';
          var rm = document.createElement('button');
          rm.type = 'button';
          rm.textContent = 'Remove';
          rm.style.marginLeft = '10px';
          rm.style.padding = '4px 8px';
          rm.addEventListener('click', function(){
            var next = selectedIndices.filter(function(v){ return v !== ai; });
            selections[q._id] = next;
            selectedIndices = next;
            renderActions();
            renderSelected();
            renderControls();
          });
          row.appendChild(rm);
          list.appendChild(row);
        });
      }

      selectedWrap.appendChild(list);
    }

    function renderActions(){
      actionsWrap.innerHTML = '';
      shuffledIdx.forEach(function(idx){
        var a = actions[idx];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level4-action';
        btn.style.padding='10px';
        btn.style.background = selectedIndices.indexOf(idx) !== -1 ? '#1e7d4f' : '#0f3460';
        btn.style.border='1px solid #e94560';
        btn.style.borderRadius='6px';
        btn.style.color = '#fff';
        btn.textContent=a;
        btn.addEventListener('click', function(){
          var pos = selectedIndices.indexOf(idx);
          if (pos !== -1) {
            selectedIndices.splice(pos, 1);
          } else {
            if (selectedIndices.length >= requiredCount) {
              alert('You can select only ' + requiredCount + ' actions. Remove one to change order.');
              return;
            }
            selectedIndices.push(idx);
          }
          selections[q._id] = selectedIndices;
          renderActions();
          renderSelected();
          renderControls();
        });
        actionsWrap.appendChild(btn);
      });
    }

    renderActions();
    questionContent.appendChild(actionsWrap);
    questionContent.appendChild(selectedWrap);
    renderSelected();

    var hint = document.createElement('div');
    hint.style.marginTop='12px';
    hint.innerHTML = '<small>Complete all 3 questions and submit. Final decision is by admin.</small>';
    questionContent.appendChild(hint);

    renderControls();
  }

  function renderControls(){
    controls.innerHTML='';
    var q = QUESTIONS[currentIndex];
    var requiredCount = Number(Array.isArray(q.correct_order) ? q.correct_order.length : 0) || 4;
    var selected = selections[q._id] || [];
    var answeredCount = QUESTIONS.filter(function(x){
      var req = Number(Array.isArray(x.correct_order) ? x.correct_order.length : 0) || 4;
      var sel = selections[x._id] || [];
      return sel.length === req;
    }).length;

    var isLast = currentIndex === QUESTIONS.length - 1;
    var nextBtn = document.createElement('button');
    nextBtn.className = isLast ? 'btn-submit' : 'btn-next';
    nextBtn.textContent = isLast
      ? ('Submit Level 4 (' + answeredCount + '/' + QUESTIONS.length + ')')
      : ('Next (' + answeredCount + '/' + QUESTIONS.length + ') →');
    nextBtn.disabled = selected.length !== requiredCount;
    nextBtn.addEventListener('click', function(){
      if (selected.length !== requiredCount) return;
      if (!isLast) {
        currentIndex++;
        renderQuestion();
        return;
      }
      submitAll();
    });

    var clearBtn = document.createElement('button');
    clearBtn.className = 'btn-next';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear Selection';
    clearBtn.style.marginLeft='10px';
    clearBtn.addEventListener('click', function(){
      selections[q._id] = [];
      renderQuestion();
    });

    controls.appendChild(nextBtn);
    controls.appendChild(clearBtn);
  }

  API.fetchQuestions(4).then(function(list){
    if (list && list.error) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">' + String(list.error) + '</p>';
      return;
    }
    if (!Array.isArray(list) || !list.length) { questionContent.innerHTML = '<p style="color:#ff6b6b;">Level 4 questions not found in MongoDB dataset.</p>'; return; }

    var scenarios = list.filter(function(q){
      return q && q.type === 'ordered_actions' && Array.isArray(q.actions) && Array.isArray(q.correct_order) && q.correct_order.length > 0;
    });
    if (scenarios.length < QUESTION_COUNT) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">Level 4 requires 3 questions in DB. Please add more questions.</p>';
      return;
    }

    var idsKey = 'level4_question_ids_' + teamId;
    var storedIds = [];
    try { storedIds = JSON.parse(sessionStorage.getItem(idsKey) || '[]'); } catch (_) { storedIds = []; }

    if (Array.isArray(storedIds) && storedIds.length === QUESTION_COUNT) {
      QUESTIONS = storedIds.map(function(id){ return scenarios.find(function(x){ return String(x._id) === String(id); }); }).filter(Boolean);
    }

    if (!QUESTIONS || QUESTIONS.length !== QUESTION_COUNT) {
      QUESTIONS = shuffle(scenarios).slice(0, QUESTION_COUNT);
      sessionStorage.setItem(idsKey, JSON.stringify(QUESTIONS.map(function(q){ return q._id; })));
    }

    renderQuestion();

    var fallbackDuration = 360; // 6 minutes
    API.getLevelStart(4).then(function(info){
      var duration = Number(info.duration) || fallbackDuration;
      var startKey = 'timer_start_' + teamId + '_L4';
      var durationKey = 'timer_duration_' + teamId + '_L4';
      var startTs = Number(sessionStorage.getItem(startKey) || 0);
      var storedDuration = Number(sessionStorage.getItem(durationKey) || 0);
      if (!startTs || storedDuration !== duration) {
        startTs = Date.now();
        sessionStorage.setItem(startKey, String(startTs));
        sessionStorage.setItem(durationKey, String(duration));
      }
      var elapsed = Math.floor((Date.now() - startTs) / 1000);
      var remaining = Math.max(0, duration - elapsed);
      if (window.ER && window.ER.initLevelTimer) timerController = ER.initLevelTimer(remaining, '#timer-count', function(){
        submitAll();
        return false;
      });
    }).catch(function(){
      if (window.ER && window.ER.initLevelTimer) timerController = ER.initLevelTimer(fallbackDuration, '#timer-count', function(){
        submitAll();
        return false;
      });
    });

  }).catch(function(){ questionContent.innerHTML = '<p style="color:#ff6b6b;">Error loading level</p>'; });

});
