// Level 1: MongoDB question-based linear exam (3 minutes)
document.addEventListener('DOMContentLoaded', function () {
  if (window.ER && window.ER.enableFullExamProtections) window.ER.enableFullExamProtections();
  if (window.ER && window.ER.detectFullScreenExit) window.ER.detectFullScreenExit();

  var teamId = sessionStorage.getItem('teamId');
  if (!teamId) {
    alert('Please login first.');
    window.location.href = '../login.html';
    return;
  }
  sessionStorage.setItem('currentLevel', '1');

  var questionContent = document.getElementById('question-content');
  var controls = document.getElementById('controls');
  var timerController = null;

  var QUESTIONS = [];
  var answers = {};
  var currentIndex = 0;
  var totalQuestions = 0;

  function shuffle(arr) {
    return arr.slice().sort(function () { return Math.random() - 0.5; });
  }

  function renderCurrentQuestion() {
    var q = QUESTIONS[currentIndex];
    if (!q) {
      questionContent.innerHTML = '<p style="color:#ff6b6b">No question available.</p>';
      return;
    }

    questionContent.innerHTML = '';

    var qText = document.createElement('div');
    qText.className = 'question-text';
    qText.innerHTML = '<strong>Q' + (currentIndex + 1) + '.</strong> ' + q.question;
    questionContent.appendChild(qText);

    var opts = document.createElement('div');
    opts.className = 'options';

    (q.options || []).forEach(function (opt, i) {
      var label = document.createElement('label');
      label.className = 'option-label';

      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'option-' + q._id;
      input.value = opt;
      input.addEventListener('change', function () {
        answers[q._id] = opt;
        renderControls();
      });

      if (answers[q._id] === opt) input.checked = true;

      var text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = String.fromCharCode(65 + i) + ') ' + opt;

      label.appendChild(input);
      label.appendChild(text);
      opts.appendChild(label);
    });

    questionContent.appendChild(opts);
    renderControls();
  }

  function renderControls() {
    var q = QUESTIONS[currentIndex];
    var answeredCount = Object.keys(answers).length;

    controls.innerHTML = '';
    var nextBtn = document.createElement('button');
    var isLast = currentIndex === (totalQuestions - 1);
    nextBtn.className = isLast ? 'btn-submit' : 'btn-next';
    nextBtn.textContent = isLast
      ? ('Submit (' + answeredCount + '/' + totalQuestions + ')')
      : ('Next (' + answeredCount + '/' + totalQuestions + ') →');
    nextBtn.disabled = !(q && answers[q._id]);

    nextBtn.addEventListener('click', function () {
      if (!q || !answers[q._id]) return;
      if (isLast) {
        submitLevel();
        return;
      }
      currentIndex++;
      renderCurrentQuestion();
    });

    controls.appendChild(nextBtn);
  }

  function submitLevel() {
    var score = 0;
    QUESTIONS.forEach(function (q) {
      if (answers[q._id] && String(answers[q._id]).trim() === String(q.answer).trim()) {
        score += Number(q.marks || 10);
      }
    });

    window.EXAM_SUBMITTED = true;
    if (timerController && timerController.stop) timerController.stop();

    API.submitScore(teamId, 1, score).then(function (response) {
      if (window.ER && window.ER.disableAllInputs) window.ER.disableAllInputs();
      
      // Show modal instead of alert
      var levelScore = response.levelScore || score;
      var nextLevel = response.nextLevel || 2;
      var title = "Level 1 Complete! 🎉";
      var message = `Congratulations! You scored ${levelScore} marks.\n\nAdvancing to Level ${nextLevel}...`;
      var redirectUrl = `level${nextLevel}.html`;
      
      showModal(title, message, redirectUrl);
      
    }).catch(function (err) {
      console.error('Failed to submit score', err);
      showModal('Error', 'Failed to submit score. Please try again.', null);
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

  function startSyncedTimer() {
    API.getLevelStart(1).then(function (info) {
      var duration = Number(info.duration) || 180;
      var startKey = 'timer_start_' + teamId + '_L1';
      var durationKey = 'timer_duration_' + teamId + '_L1';
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
        timerController = ER.initLevelTimer(remaining, '#timer-count', function () {
          // Time-up behavior: freeze and submit current evaluated answers
          submitLevel();
        });
      }
    }).catch(function () {
      if (window.ER && window.ER.initLevelTimer) {
        timerController = ER.initLevelTimer(180, '#timer-count', function () { submitLevel(); });
      }
    });
  }

  function loadQuestions() {
    API.fetchQuestions(1).then(function (list) {
      if (!Array.isArray(list) || list.length === 0) {
        var msg = (list && list.error) ? list.error : 'No questions returned from MongoDB for level 1.';
        questionContent.innerHTML = '<p style="color:#ff6b6b">' + msg + '</p>';
        return;
      }

      QUESTIONS = shuffle(list).slice(0, 6);
      totalQuestions = QUESTIONS.length;
      currentIndex = 0;
      answers = {};

      renderCurrentQuestion();
    }).catch(function (err) {
      console.error('Failed loading questions', err);
      questionContent.innerHTML = '<p style="color:#ff6b6b">Failed to load questions from backend. Check server and DB connection.</p>';
    });
  }

  loadQuestions();
  startSyncedTimer();
});
