import { supabase } from './supabase-client.js';

let currentExam = null;
let currentUser = null;
let inactivityCount = 0;
let timeRemaining = 0;
let timerInterval = null;
let attemptRecordId = null;

const startBtn = document.getElementById('start-exam-btn');
const wrapper = document.getElementById('exam-wrapper');
const entrance = document.getElementById('entrance-screen');
const violationOverlay = document.getElementById('violation-overlay');

async function initExam() {
    const params = new URLSearchParams(window.location.search);
    const examId = params.get('id');

    if (!examId) {
        alert("Invalid Assessment Session.");
        window.location.href = 'index.html';
        return;
    }

    // 1. Auth check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'landing.html';
        return;
    }
    currentUser = session.user;

    // 2. Fetch Exam details
    const { data: exam, error } = await supabase.from('exams').select('*').eq('id', examId).single();
    if (error || !exam) {
        alert("Assessment not found or inactive.");
        window.location.href = 'index.html';
        return;
    }
    currentExam = exam;
    
    // Check if exam is expired
    try {
        if (exam.description) {
            const desc = JSON.parse(exam.description);
            if (desc.deadline_at && new Date() > new Date(desc.deadline_at)) {
                // Fetch to check if they already submitted, otherwise boot
                const { data: extAtt } = await supabase.from('exam_attempts').select('status').eq('exam_id', examId).eq('student_id', currentUser.id).single();
                if (!extAtt || extAtt.status === 'in_progress') {
                    alert("This assessment's deadline has passed. Entry is strictly disabled.");
                    window.location.href = 'index.html';
                    return;
                }
            }
        }
    } catch(err){}
    
    timeRemaining = exam.duration_minutes * 60;

    // 3. Populate Entrance Screen
    document.getElementById('ent-title').innerText = exam.title;
    document.getElementById('ent-subject').innerText = exam.subject;
    document.getElementById('ent-instructions').innerText = exam.instructions || 'Follow standard protocol. No navigating away from this window.';
    document.getElementById('ent-duration').innerText = exam.duration_minutes;
    document.getElementById('ent-marks').innerText = exam.total_marks;

    // 4. Initial attempt Record (Log entry)
    const { data: existingAttempt } = await supabase.from('exam_attempts').select('*').eq('exam_id', exam.id).eq('student_id', currentUser.id).single();
    
    if (existingAttempt) {
        if (existingAttempt.status !== 'in_progress') {
            alert("You have already completed this assessment.");
            window.location.href = 'index.html';
            return;
        }
        attemptRecordId = existingAttempt.id;
        inactivityCount = existingAttempt.inactivity_count || 0;
        
        // Update display
        document.getElementById('violation-display').innerText = inactivityCount;

        // Calculate remaining time based on started_at
        const startedAt = new Date(existingAttempt.started_at).getTime();
        const now = new Date().getTime();
        const elapsedSeconds = Math.floor((now - startedAt) / 1000);
        timeRemaining = Math.max(0, (exam.duration_minutes * 60) - elapsedSeconds);
        
        if (timeRemaining <= 0) {
            autoSubmit(); // Time is up, force submit
            return;
        }
    }

    startBtn.disabled = false;
    startBtn.innerText = "Request Full Screen Validation";
    startBtn.addEventListener('click', requestFullScreenAndStart);
}

async function requestFullScreenAndStart() {
    try {
        if (!document.fullscreenElement) {
             await document.documentElement.requestFullscreen();
        }
        startProtocol();
    } catch (err) {
        alert("Fullscreen is required to start the assessment. Please allow it or press F11.");
    }
}

async function startProtocol() {
    entrance.style.opacity = '0';
    setTimeout(() => entrance.classList.add('hidden'), 500);

    wrapper.classList.remove('opacity-0', 'pointer-events-none');
    
    document.getElementById('main-title').innerText = currentExam.title;
    document.getElementById('main-subject').innerText = currentExam.subject;

    renderQuestions();

    // Start Timer
    updateTimeDisplay();
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimeDisplay();
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            autoSubmit();
        }
    }, 1000);

    // Create Attempt if not exists
    if (!attemptRecordId) {
        const meta = currentUser.user_metadata || {};
        const { data: attempt, error } = await supabase.from('exam_attempts').insert([{
            exam_id: currentExam.id,
            student_id: currentUser.id,
            student_name: meta.name || meta.full_name || currentUser.email,
            student_email: currentUser.email,
            student_reg_no: meta.register_number || meta.reg_no || 'N/A',
            student_class: meta.class || meta.grade || 'N/A',
            status: 'in_progress',
            inactivity_count: 0
        }]).select('id').single();
        
        if (attempt) attemptRecordId = attempt.id;
    }

    // Set up Anti-cheat
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    
    document.getElementById('resume-exam-btn').addEventListener('click', () => {
        if (!document.fullscreenElement) {
             document.documentElement.requestFullscreen().catch(err => alert("Fullscreen required."));
        }
        violationOverlay.classList.remove('flex');
        violationOverlay.classList.add('hidden');
        wrapper.classList.remove('exam-blur');
    });

    document.getElementById('finish-exam-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to submit your assessment now? This cannot be undone.")) {
            autoSubmit();
        }
    });
}

function renderQuestions() {
    const qContainer = document.getElementById('questions-container');
    const questions = currentExam.questions;
    
    qContainer.innerHTML = questions.map((q, i) => {
        const opts = q.options.map((opt, optIdx) => `
            <label class="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                <input type="radio" name="${q.id}" value="${optIdx}" class="w-5 h-5 text-indigo-600 border-slate-300 focus:ring-indigo-500 q-answer">
                <span class="text-sm font-medium text-slate-700">${opt}</span>
            </label>
        `).join('');

        return `
        <div class="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 q-block" data-qid="${q.id}">
            <div class="flex justify-between items-start mb-6">
                <h3 class="text-lg font-bold text-slate-900 leading-snug"><span class="text-indigo-500 mr-2 font-black">${i+1}.</span> ${q.text}</h3>
                <span class="shrink-0 bg-slate-100 text-slate-500 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full">${q.marks} Pts</span>
            </div>
            <div class="space-y-3">
                ${opts}
            </div>
        </div>
        `;
    }).join('');
}

function updateTimeDisplay() {
    const h = Math.floor(timeRemaining / 3600);
    const m = Math.floor((timeRemaining % 3600) / 60);
    const s = timeRemaining % 60;
    document.getElementById('time-display').innerText = 
        `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function handleViolation() {
    inactivityCount++;
    document.getElementById('violation-display').innerText = inactivityCount;
    document.getElementById('overlay-violation-count').innerText = inactivityCount;
    
    violationOverlay.classList.remove('hidden');
    violationOverlay.classList.add('flex');
    wrapper.classList.add('exam-blur');

    // Attempt to log immediately
    if (attemptRecordId) {
        supabase.from('exam_attempts').update({ inactivity_count: inactivityCount }).eq('id', attemptRecordId).then();
    }
}

function handleBlur() {
    handleViolation();
}

function handleVisibilityChange() {
    if (document.hidden) handleViolation();
}

function handleFullScreenChange() {
    if (!document.fullscreenElement) handleViolation();
}

// Block Copy-Paste & Screenshot shortcuts
window.addEventListener('keydown', (e) => {
    // Block CMD/CTRL + C, V, X, P (Print), S (Save)
    if ((e.metaKey || e.ctrlKey) && ['c', 'v', 'x', 'p', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        alert("Copying or saving contents is strictly prohibited.");
    }
    // Block PrintScreen
    if (e.key === "PrintScreen") {
        navigator.clipboard.writeText(""); // clears clipboard
        handleViolation();
        alert("Screenshots are strictly prohibited!");
    }
});

async function autoSubmit() {
    clearInterval(timerInterval);
    
    // Disable handlers
    window.removeEventListener('blur', handleBlur);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('fullscreenchange', handleFullScreenChange);
    
    wrapper.classList.add('opacity-50', 'pointer-events-none');
    document.getElementById('finish-exam-btn').innerText = "Evaluating...";

    const questions = currentExam.questions;
    let score = 0;
    const answers = [];

    questions.forEach(q => {
        const block = document.querySelector(`.q-block[data-qid="${q.id}"]`);
        const checked = block.querySelector('.q-answer:checked');
        const selectedVal = checked ? parseInt(checked.value, 10) : null;
        
        answers.push({ question_id: q.id, selected_answer: selectedVal });
        
        if (selectedVal !== null && selectedVal === q.answer) {
            score += q.marks;
        }
    });

    if (attemptRecordId) {
        let releaseMode = 'immediate';
        try {
            if (currentExam.description) {
                const descMap = JSON.parse(currentExam.description);
                if (descMap.release_mode) releaseMode = descMap.release_mode;
            }
        } catch(e) {}
        
        const finalStatus = releaseMode === 'manual' ? 'submitted' : 'evaluated';

        await supabase.from('exam_attempts').update({
            status: finalStatus,
            completed_at: new Date().toISOString(),
            score: score,
            answers: answers,
            inactivity_count: inactivityCount
        }).eq('id', attemptRecordId);
    }

    if (document.fullscreenElement) {
        await document.exitFullscreen().catch(e => console.log(e));
    }

    alert(`Assessment Completed Successfully!`);
    window.location.href = 'index.html';
}

// Kickoff
initExam();
