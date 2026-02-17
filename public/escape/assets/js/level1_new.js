// Level 1: Proctored Exam - NPTEL Style (6 min, randomized Q, marks-based)
document.addEventListener('DOMContentLoaded', function(){
    // Enable all anti-cheat protections
    if (window.ER && window.ER.enableFullExamProtections) {
        window.ER.enableFullExamProtections();
    }
    if (window.ER && window.ER.detectFullScreenExit) {
        window.ER.detectFullScreenExit();
    }

    // Require login: ensure teamId exists in sessionStorage
    var teamId = sessionStorage.getItem('teamId');
    if (!teamId) {
        alert('Please log in before starting.');
        window.location.href = '../login.html';
        return;
    }

    var timerController = null;
    var QUESTIONS = [];
    var answers = {}; // question id -> selected answer text
    var currentIndex = 0;
    const TOTAL_QUESTIONS = 6;
    const TIME_LIMIT_SECONDS = 360; // 6 minutes

    // DOM elements
    var timerDisplay = document.getElementById('timer-count');
    var questionContent = document.getElementById('question-content');
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');
    var questionList = document.getElementById('question-list');

    // Render a single question
    function renderQuestion(index) {
        if (!QUESTIONS || QUESTIONS.length === 0) {
            questionContent.innerHTML = '<p style="color:#e6eef8;">Loading questions...</p>';
            return;
        }
        
        var q = QUESTIONS[index];
        if (!q) {
            questionContent.innerHTML = '<p style="color:#e6eef8;">No question available.</p>';
            return;
        }

        // Clear previous
        questionContent.innerHTML = '';

        // Question number and text
        var qText = document.createElement('div');
        qText.className = 'question-text';
        qText.innerHTML = '<strong>Q' + (index + 1) + '. </strong>' + q.question;
        questionContent.appendChild(qText);

        // Options (radio buttons)
        var optsDiv = document.createElement('div');
        optsDiv.className = 'options';
        
        q.options.forEach(function(opt, i) {
            var label = document.createElement('label');
            label.className = 'option-label';
            
            var input = document.createElement('input');
            input.type = 'radio';
            input.name = 'option-' + q._id;
            input.value = opt;
            input.addEventListener('change', function() {
                answers[q._id] = opt;
                updateNextButton();
                updateQuestionListUI();
            });

            var span = document.createElement('span');
            span.className = 'option-text';
            span.textContent = String.fromCharCode(65 + i) + ') ' + opt; // A, B, C, D...

            label.appendChild(input);
            label.appendChild(span);
            optsDiv.appendChild(label);
        });

        questionContent.appendChild(optsDiv);

        // Restore previous selection if exists
        if (answers[q._id]) {
            var radios = questionContent.querySelectorAll('input[name="option-' + q._id + '"]');
            radios.forEach(function(r) {
                if (r.value === answers[q._id]) r.checked = true;
            });
        }

        updateNextButton();
    }

    // Update Next button text and state
    function updateNextButton() {
        var q = QUESTIONS[currentIndex];
        var isAnswered = q && answers[q._id];
        
        if (currentIndex === TOTAL_QUESTIONS - 1) {
            nextBtn.textContent = 'Submit (' + Object.keys(answers).length + '/' + TOTAL_QUESTIONS + ')';
            nextBtn.classList.add('btn-submit');
            nextBtn.classList.remove('btn-next');
        } else {
            nextBtn.textContent = 'Next (' + Object.keys(answers).length + '/' + TOTAL_QUESTIONS + ')';
            nextBtn.classList.remove('btn-submit');
            nextBtn.classList.add('btn-next');
        }
        
        nextBtn.disabled = !isAnswered;
        prevBtn.disabled = currentIndex === 0;
    }

    // Update sidebar question list UI
    function updateQuestionListUI() {
        var buttons = questionList.querySelectorAll('.q-button');
        buttons.forEach(function(btn, i) {
            btn.classList.remove('active', 'answered');
            
            if (i === currentIndex) {
                btn.classList.add('active');
            }
            
            var q = QUESTIONS[i];
            if (answers[q._id]) {
                btn.classList.add('answered');
            }
        });
    }

    // Render sidebar question list
    function renderQuestionList() {
        questionList.innerHTML = '';
        QUESTIONS.forEach(function(q, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'q-button';
            if (i === currentIndex) btn.classList.add('active');
            btn.textContent = (i + 1);
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                currentIndex = i;
                renderQuestion(i);
                updateQuestionListUI();
            });
            questionList.appendChild(btn);
        });
    }

    // Next button handler
    nextBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var q = QUESTIONS[currentIndex];
        if (!answers[q._id]) return; // require selection
        
        if (currentIndex === TOTAL_QUESTIONS - 1) {
            // Submit
            submitExam();
            return;
        }
        
        currentIndex++;
        renderQuestion(currentIndex);
        updateQuestionListUI();
    });

    // Previous button handler
    prevBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (currentIndex === 0) return;
        currentIndex--;
        renderQuestion(currentIndex);
        updateQuestionListUI();
    });

    // Submit exam and calculate marks
    function submitExam() {
        // Calculate score based on marks per question
        var totalMarks = 0;
        QUESTIONS.forEach(function(q) {
            if (answers[q._id] && answers[q._id] === q.answer) {
                totalMarks += (q.marks || 10);
            }
        });

        console.log('✓ Exam submitted. Total marks:', totalMarks);

        // Submit to API
        if (window.API && API.submitScore) {
            API.submitScore(teamId, 1, totalMarks).then(function(res) {
                console.log('Score submitted:', res);
                // Stop timer
                if (timerController && timerController.stop) {
                    timerController.stop();
                }
                // Disable all inputs
                if (window.ER && window.ER.disableAllInputs) {
                    window.ER.disableAllInputs();
                }
                // Redirect to waiting page
                setTimeout(function() {
                    window.location.href = '../result/waiting.html';
                }, 1000);
            }).catch(function(err) {
                console.error('Failed to submit score:', err);
                alert('Error submitting exam. Please try again.');
            });
        }
    }

    // Timer expiration handler
    function onTimeExpire() {
        console.log('Time expired - auto-submitting exam');
        submitExam();
    }

    // Load questions from API
    if (window.API && API.fetchQuestions) {
        API.fetchQuestions(1).then(function(list) {
            if (list && list.length > 0) {
                // Randomize questions
                QUESTIONS = list.slice(0, TOTAL_QUESTIONS).sort(function() {
                    return Math.random() - 0.5;
                });
                
                // Reset state
                currentIndex = 0;
                answers = {};
                
                // Render UI
                renderQuestionList();
                renderQuestion(0);
                
                console.log('✓ Questions loaded and randomized');
            } else {
                questionContent.innerHTML = '<p style="color:#e6eef8;">Error: No questions available.</p>';
            }
        }).catch(function(err) {
            console.error('API fetch failed:', err);
            questionContent.innerHTML = '<p style="color:#ff6b6b;">Error loading questions. Please refresh.</p>';
        });
    }

    // Start timer (360 seconds = 6 minutes)
    if (window.ER && window.ER.initLevelTimer) {
        timerController = ER.initLevelTimer(TIME_LIMIT_SECONDS, '#timer-count', onTimeExpire);
    }
});
