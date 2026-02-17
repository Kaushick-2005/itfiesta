// Level 3: Logic Lock / Code Crack (5 minutes, 3 questions)
document.addEventListener('DOMContentLoaded', function(){
  if (window.ER && window.ER.enableFullExamProtections) window.ER.enableFullExamProtections();
  if (window.ER && window.ER.detectFullScreenExit) window.ER.detectFullScreenExit();

  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) { alert('Please start from main page'); window.location.href='../index.html'; return; }
  sessionStorage.setItem('currentLevel', '3');

  var QUESTION_COUNT = 3;
  var questionContent = document.getElementById('question-content');
  var controls = document.querySelector('.controls');
  var timerController = null;

  var QUESTIONS = [];
  var currentIndex = 0;
  var answers = {};
  var submitInProgress = false;
  var hasSubmitted = false;

  function shuffle(arr){ return arr.slice().sort(function(){ return Math.random() - 0.5; }); }
  function norm(s){ return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }

  function flattenPuzzles(list){
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function(doc, dIdx){
      if (!doc || typeof doc !== 'object') return;

      if (Array.isArray(doc.questions)) {
        doc.questions.forEach(function(q, qIdx){
          if (!q || typeof q !== 'object') return;
          if (!q.final_code) return;
          out.push(Object.assign({}, q, {
            _qid: String((doc._id || ('doc_' + dIdx)) + '_q_' + qIdx),
            _parentTitle: doc.title || '',
            marks: Number(q.marks || doc.marks || 20)
          }));
        });
      }

      if (doc.final_code) {
        out.push(Object.assign({}, doc, {
          _qid: String(doc._id || ('doc_' + dIdx)),
          marks: Number(doc.marks || 20)
        }));
      }
    });
    return out;
  }

  function isCorrect(q, val){
    return norm(val) === norm(q.final_code || '');
  }

  function renderQuestion(){
    var q = QUESTIONS[currentIndex];
    if (!q) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">No Level 3 question available.</p>';
      return;
    }

    var clues = Array.isArray(q.clues) ? q.clues : [];
    var cluesHtml = clues.length
      ? clues.map(function(c, i){
          var line = (c && c.clue) ? c.clue : String(c || '');
          return '<div style="margin-bottom:8px;"><strong>Clue ' + (i + 1) + ':</strong> ' + line + '</div>';
        }).join('')
      : '<div style="margin-bottom:8px;">' + (q.question || 'Solve and enter final code.') + '</div>';

    var title = q.title || q._parentTitle || ('Question ' + (currentIndex + 1));
    var value = answers[q._qid] || '';

    questionContent.innerHTML = '';
    var block = document.createElement('div');
    block.className = 'question-text';
    block.innerHTML = '<strong>Question ' + (currentIndex + 1) + ' / ' + QUESTIONS.length + ':</strong> ' + title +
      '<br>' + cluesHtml +
      (q.final_rule ? ('<div style="margin-top:10px;"><strong>Rule:</strong> ' + q.final_rule + '</div>') : '');
    questionContent.appendChild(block);

    var input = document.createElement('input');
    input.type = 'text';
    input.id = 'level3-answer';
    input.placeholder = 'Enter final code';
    input.value = value;
    input.style.width = '100%';
    input.style.padding = '12px';
    input.style.marginTop = '14px';
    input.addEventListener('input', function(){
      answers[q._qid] = input.value;
      renderControls();
    });
    questionContent.appendChild(input);

    renderControls();
  }

  function renderControls(){
    controls.innerHTML = '';
    var isLast = currentIndex === QUESTIONS.length - 1;
    var q = QUESTIONS[currentIndex];
    var answeredCount = QUESTIONS.filter(function(x){ return String(answers[x._qid] || '').trim(); }).length;

    var btn = document.createElement('button');
    btn.className = isLast ? 'btn-submit' : 'btn-next';
    btn.textContent = isLast
      ? ('Submit Level 3 (' + answeredCount + '/' + QUESTIONS.length + ')')
      : ('Next (' + answeredCount + '/' + QUESTIONS.length + ') →');
    btn.disabled = !(q && String(answers[q._qid] || '').trim());

    btn.addEventListener('click', function(){
      if (!q || !String(answers[q._qid] || '').trim()) return;
      if (!isLast) {
        currentIndex++;
        renderQuestion();
      } else {
        submitAll();
      }
    });
    controls.appendChild(btn);
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
      var user = answers[q._qid] || '';
      if (isCorrect(q, user)) score += Number(q.marks || 20);
    });

    API.submitScore(teamId, 3, score).then(function(resp){
      // Show modal instead of alert
      var levelScore = resp.levelScore || score;
      var nextLevel = resp.nextLevel || 4;
      var title = "Level 3 Complete! 🎉";
      var message = `Congratulations! You scored ${levelScore} marks.\n\nAdvancing to Level ${nextLevel}...`;
      var redirectUrl = `level${nextLevel}.html`;
      
      showModal(title, message, redirectUrl);
      
    }).catch(function(){
      // Keep admin-decision flow even on intermittent submit errors.
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

  function handleTimeout(){
    if (submitInProgress || hasSubmitted || window.EXAM_SUBMITTED) return false;
    submitAll();
    return false;
  }

  function startTimer(){
    var fallbackDuration = 300;
    API.getLevelStart(3).then(function(info){
      var duration = Number(info.duration) || fallbackDuration;
      var startKey = 'timer_start_' + teamId + '_L3';
      var durationKey = 'timer_duration_' + teamId + '_L3';
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
        timerController = ER.initLevelTimer(remaining, '#timer-count', handleTimeout);
      }
    }).catch(function(){
      if (window.ER && window.ER.initLevelTimer) {
        timerController = ER.initLevelTimer(fallbackDuration, '#timer-count', handleTimeout);
      }
    });
  }

  API.fetchQuestions(3).then(function(list){
    var pool = flattenPuzzles(list);
    if (pool.length < QUESTION_COUNT) {
      questionContent.innerHTML = '<p style="color:#ff6b6b;">Level 3 requires 3 questions in DB. Please add more questions.</p>';
      return;
    }

    var idsKey = 'level3_question_ids_' + teamId;
    var storedIds = [];
    try { storedIds = JSON.parse(sessionStorage.getItem(idsKey) || '[]'); } catch (_) { storedIds = []; }

    if (Array.isArray(storedIds) && storedIds.length === QUESTION_COUNT) {
      QUESTIONS = storedIds.map(function(id){ return pool.find(function(q){ return String(q._qid) === String(id); }); }).filter(Boolean);
    }

    if (!QUESTIONS || QUESTIONS.length !== QUESTION_COUNT) {
      QUESTIONS = shuffle(pool).slice(0, QUESTION_COUNT);
      sessionStorage.setItem(idsKey, JSON.stringify(QUESTIONS.map(function(q){ return q._qid; })));
    }

    renderQuestion();
    startTimer();
  }).catch(function(){
    questionContent.innerHTML = '<p style="color:#ff6b6b;">Error loading level.</p>';
  });
});
