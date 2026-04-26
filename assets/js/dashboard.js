// Dashboard Specific Logic
function updateDashboardStats() {
    const stats = window.getStats();
    
    // Update simple counters
    document.getElementById('stat-classesJoined').innerText = stats.interactions.classesJoined;
    document.getElementById('stat-notesViewed').innerText = stats.interactions.notesViewed;
    // document.getElementById('stat-quizzesStarted').innerText = stats.interactions.quizzesStarted;

    // Update total time: strictly rely on the authoritative Supabase value in layout.js
    if (window._supabaseTimeSpent === null || window._supabaseTimeSpent === undefined) {
        document.getElementById('stat-timeSpent').innerText = '...';
        // wait for layout.js to successfully ping us via updateDashboardStats() once loaded
        return; 
    }
    
    const totalMinutes = window._supabaseTimeSpent;
    
    let formattedTime;
    if (totalMinutes >= 60) {
        formattedTime = Math.floor(totalMinutes / 60) + 'h';
    } else {
        formattedTime = totalMinutes + 'm';
    }
    
    document.getElementById('stat-timeSpent').innerText = formattedTime;

    // Update recent activity list
    const activityList = document.getElementById('recent-activity-list');
    if (activityList) {
        if (stats.recentActivity.length > 0) {
            activityList.innerHTML = stats.recentActivity.map(act => `
                <div class="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded transition-colors">
                    <div class="size-2 bg-primary rounded-full"></div>
                    <div class="flex-1">
                        <p class="text-xs font-medium text-slate-800 dark:text-slate-200">${formatActivity(act.type, act.detail)}</p>
                        <p class="text-[10px] text-slate-500">${new Date(act.timestamp).toLocaleTimeString()}</p>
                    </div>
                </div>
            `).join('');
        }
    }
}

function formatActivity(type, detail) {
    switch(type) {
        case 'classesJoined': return `Joined class: ${detail}`;
        case 'notesViewed': return `Viewed notes: ${detail}`;
        case 'notesDownloaded': return `Downloaded notes: ${detail}`;
        // case 'quizzesStarted': return `Started quiz: ${detail}`;
        default: return type;
    }
}

window.updateDashboardStats = updateDashboardStats;

async function loadStudentLiveClasses() {
    const list = document.getElementById('student-live-classes-list');
    if (!list) return;

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;
        const studentId = session.user.id;

        // Find my mentor first to filter mentor-led classes
        const { data: mentorReq } = await window.supabase
            .from('mentorship_requests')
            .select('mentor_id')
            .eq('mentee_id', studentId)
            .eq('status', 'accepted')
            .maybeSingle();
        const myMentorId = mentorReq?.mentor_id;

        // 1. Fetch classes (Remove invalid column filter)
        let query = window.supabase
            .from('online_classes')
            .select('*')
            .order('class_date', { ascending: false })
            .order('class_time', { ascending: false })
            .limit(30); // Fetch more for manual filtering

        const { data: rawData, error: classesError } = await query;
        if (classesError) throw classesError;

        // Helper to parse embedded metadata
        const parseMeta = (d) => {
            if (!d) return { target: 'student', mentorId: null, selected: null };
            const t = d.match(/\[T:(.*?)\]/);
            const m = d.match(/\[M:(.*?)\]/);
            const s = d.match(/\[S:(.*?)\]/);
            return { 
                target: t ? t[1] : (s ? 'select' : 'student'), 
                mentorId: m ? m[1] : null,
                selected: s ? s[1].split(',') : null
            };
        };

        // 2. Filter logic: Show if (target == 'student' AND (it's faculty OR it's MY mentor))
        const finalClasses = rawData.filter(c => {
            const meta = parseMeta(c.description);
            
            // If targeted to specific students
            if (meta.selected) {
                return meta.selected.includes(currentUser.id);
            }

            if (meta.target !== 'student') return false;
            if (!meta.mentorId) return true; // Faculty class for students
            return meta.mentorId === myMentorId; // Mentor class for ME
        });

        if (!finalClasses || finalClasses.length === 0) {
            list.innerHTML = `<div class="p-8 text-center flex flex-col items-center justify-center text-slate-400">
                <span class="material-symbols-outlined text-4xl mb-2 opacity-20">event_busy</span>
                <p class="text-xs font-medium">No sessions scheduled for your cohort.</p>
            </div>`;
            return;
        }

        // 3. Resolve names (Using existing faculty_id column as creator)
        const creatorIds = [...new Set(finalClasses.map(c => c.faculty_id))];
        let creatorMap = {};
        if (creatorIds.length > 0) {
            const { data: profiles } = await window.supabase
                .from('users')
                .select('id, name')
                .in('id', creatorIds);
            if (profiles) profiles.forEach(p => creatorMap[p.id] = p.name);
        }

        // 4. Render HTML
        list.innerHTML = finalClasses.map(c => {
             const meta = parseMeta(c.description);
             return `
            <div class="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-primary/40 transition-all shadow-sm">
                <div class="flex flex-col gap-0.5">
                    <div class="flex items-center gap-2">
                        <p class="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-widest">${new Date(c.class_date).toLocaleDateString([], {month: 'short', day: 'numeric'})} | ${c.class_time.substring(0, 5)}</p>
                        <span class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${c.duration_minutes}m</span>
                    </div>
                    <h5 class="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">${c.title}</h5>
                    <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${creatorMap[c.faculty_id] || 'Faculty Hub'}</p>
                </div>
                <button onclick="window.open('${c.meet_link}', '_blank')" class="size-10 bg-primary text-white rounded-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-primary/20">
                    <span class="material-symbols-outlined text-[20px]">videocam</span>
                </button>
            </div>
        `}).join('');

    } catch (err) {
        console.error("Dashboard sessions failed:", err);
        list.innerHTML = `<div class="p-6 text-center text-[10px] text-red-500 font-black uppercase tracking-widest">Protocol error: Sync Failed</div>`;
    }
}

async function loadMentorshipConnect() {
    const list = document.getElementById('available-mentors-list');
    if (!list) return;

    try {
        const currentUser = await (await window.supabase.auth.getSession()).data.session?.user;
        if (!currentUser) return;

        // Fetch user profile to check if they are a slow learner (standard student can also request, let's keep it open or check flag if needed)
        
        // 1. Fetch available mentors
        const { data: mentors, error: mentorErr } = await window.supabase.from('users').select('id, name').eq('role', 'mentor');
        if (mentorErr) throw mentorErr;

        if (!mentors || mentors.length === 0) {
            list.innerHTML = `<div class="p-12 border-2 border-dashed border-indigo-200/50 rounded-2xl text-center"><p class="text-sm font-bold text-indigo-400">No mentors available yet.</p></div>`;
            return;
        }

        // 2. Fetch my requests
        const { data: myRequests, error: reqErr } = await window.supabase.from('mentorship_requests').select('mentor_id, status').eq('mentee_id', currentUser.id);
        if (reqErr) throw reqErr;

        const reqMap = {};
        if (myRequests) myRequests.forEach(r => reqMap[r.mentor_id] = r.status);

        // 3. Render list
        renderMentorList(mentors, reqMap);

        // 4. Real-time enrollment listening
        if (window.mentorshipSubscription) window.supabase.removeChannel(window.mentorshipSubscription);
        window.mentorshipSubscription = window.supabase.channel('my_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mentorship_requests', filter: `mentee_id=eq.${currentUser.id}` }, () => {
                loadMentorshipConnect();
            }).subscribe();

    } catch (err) {
        console.error("Failed to load mentors:", err);
        list.innerHTML = `<div class="p-4 text-center text-xs text-red-500 font-medium">Error loading mentors.</div>`;
    }
}

function renderMentorList(mentors, reqMap) {
    const list = document.getElementById('available-mentors-list');
    list.innerHTML = mentors.map(m => {
        const status = reqMap[m.id];
        
        let actionBtn = `<button onclick="requestMentor('${m.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm">Send Request</button>`;
        if (status === 'pending') {
            actionBtn = `<span class="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse">Pending</span>`;
        } else if (status === 'accepted') {
            actionBtn = `<span class="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-green-100">Enrolled</span>`;
        } else if (status === 'rejected') {
            actionBtn = `<span class="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">Unavailable</span>`;
        }

        return `
            <div class="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:shadow-md transition-shadow">
                <div class="flex items-center gap-3">
                    <div class="size-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-black">${m.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <p class="font-bold text-sm text-slate-900 dark:text-white">${m.name}</p>
                        <p class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Peer Mentor</p>
                    </div>
                </div>
                ${actionBtn}
            </div>
        `;
    }).join('');
}

window.requestMentor = async function(mentorId) {
    try {
        const currentUser = await (await window.supabase.auth.getSession()).data.session?.user;
        const { error } = await window.supabase.from('mentorship_requests').insert([{
            mentee_id: currentUser.id,
            mentor_id: mentorId,
            status: 'pending'
        }]);
        if (error) throw error;
        loadMentorshipConnect();
    } catch(err) {
        alert("Failed to send request: " + err.message);
    }
};

window.updateDashboardStats = updateDashboardStats;
window.loadStudentLiveClasses = loadStudentLiveClasses; // Expose to layout.js
window.loadMentorshipConnect = loadMentorshipConnect;
async function initDashboard() {
    // Wait for window.supabase to be available (defer-safe)
    if (!window.supabase) {
        setTimeout(initDashboard, 100);
        return;
    }

    loadStudentLiveClasses();
    loadStudentAnnouncements();
    updateDashboardStats();
    loadStudentExams();
    loadUpcomingDeadlines();
}

async function loadUpcomingDeadlines() {
    const list = document.getElementById('deadlines-list');
    if (!list) return;

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;
        const userId = session.user.id;

        // 1. Fetch Classes (Today onwards)
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: classes } = await window.supabase
            .from('online_classes')
            .select('*')
            .gte('class_date', todayStr)
            .order('class_date', { ascending: true })
            .limit(5);

        // 2. Fetch Exams (Skill Checks)
        const { data: exams } = await window.supabase
            .from('exams')
            .select('*')
            .eq('is_active', true);

        const deadlines = [];

        // Process Classes
        if (classes) {
            classes.forEach(c => {
                const date = new Date(c.class_date);
                const isToday = date.toDateString() === new Date().toDateString();
                deadlines.push({
                    title: `Live Class: ${c.title}`,
                    date: date,
                    time: c.class_time.substring(0, 5),
                    type: 'class',
                    label: isToday ? 'TODAY' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
                });
            });
        }

        // Process Exams
        if (exams) {
            exams.forEach(e => {
                // target_user_ids filtering
                if (e.target_audience === 'specific') {
                    if (!e.target_user_ids || !e.target_user_ids.includes(userId)) return;
                }
                
                let desc = {};
                try { if (e.description) desc = JSON.parse(e.description); } catch(err){}
                
                if (desc.deadline_at) {
                    const deadDate = new Date(desc.deadline_at);
                    if (deadDate >= new Date()) {
                        const isToday = deadDate.toDateString() === new Date().toDateString();
                        deadlines.push({
                            title: `Skill Check: ${e.title}`,
                            date: deadDate,
                            time: deadDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                            type: 'exam',
                            label: isToday ? 'TODAY' : deadDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
                        });
                    }
                }
            });
        }

        // Sort chronologically
        deadlines.sort((a, b) => a.date - b.date);

        if (deadlines.length === 0) {
            list.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">No upcoming deadlines found.<br>You're all caught up!</p>`;
            return;
        }

        list.innerHTML = deadlines.map(d => {
            const isUrgent = d.label === 'TODAY';
            const bgColor = isUrgent ? 'bg-red-50 dark:bg-red-900/10' : 'bg-slate-50 dark:bg-slate-800';
            const borderColor = isUrgent ? 'border-red-500' : 'border-indigo-400/20';
            const textColor = isUrgent ? 'text-red-800 dark:text-red-400' : 'text-slate-500';

            return `
                <div class="p-3 ${bgColor} border-l-4 ${borderColor} rounded transition-all hover:scale-[1.01] shadow-sm">
                    <p class="text-[9px] font-black ${textColor} uppercase tracking-widest flex items-center gap-1.5">
                        <span class="material-symbols-outlined text-[12px]">${d.type === 'class' ? 'videocam' : 'timer'}</span>
                        ${d.label}${d.time ? ' • ' + d.time : ''}
                    </p>
                    <p class="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">${d.title}</p>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load deadlines:", err);
        list.innerHTML = `<p class="text-xs text-red-400 italic">Error loading schedule.</p>`;
    }
}

async function loadStudentExams() {
    const list = document.getElementById('student-exams-list');
    const badge = document.getElementById('exam-badge');
    if (!list) return;

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;
        const studentId = session.user.id;

        // Fetch exams where student is in target_user_ids or audience is 'all_slow_learners'
        // For simplicity, we just fetch all active exams and filter locally since target_user_ids is JSONB
        // In a strict prod, use Postgres functions or strict RLS.
        const { data: exams, error } = await window.supabase
            .from('exams')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Fetch user attempts
        const { data: attempts } = await window.supabase
            .from('exam_attempts')
            .select('exam_id, status, score')
            .eq('student_id', studentId);
            
        const attemptMap = {};
        if (attempts) {
            attempts.forEach(a => attemptMap[a.exam_id] = a);
        }

        const validExams = exams.filter(e => {
            let desc = {};
            try { if (e.description) desc = JSON.parse(e.description); } catch(err){}
            if (desc.deadline_at && new Date() > new Date(desc.deadline_at)) {
                // If past deadline, only show if student has already evaluated/submitted it
                const att = attemptMap[e.id];
                if (!att || att.status === 'in_progress') return false;
            }

            if (e.target_audience === 'all_slow_learners') return true; // Assuming this user is a slow learner if they see this
            if (e.target_audience === 'specific') {
                return e.target_user_ids && e.target_user_ids.includes(studentId);
            }
            return false;
        });

        if (validExams.length === 0) {
            list.innerHTML = `<p class="text-xs text-indigo-200 italic mt-6">No scheduled assessments at this time.</p>`;
            badge.innerText = '0';
            return;
        }

        badge.innerText = validExams.length;

        list.innerHTML = validExams.map(exam => {
            const attempt = attemptMap[exam.id];
            
            let statusBtn = `<a href="exam.html?id=${exam.id}" class="mt-3 block w-full py-2 bg-white text-indigo-700 text-center text-xs font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-colors">Start Assessment</a>`;
            
            if (attempt) {
                if (attempt.status === 'in_progress') {
                    statusBtn = `<a href="exam.html?id=${exam.id}" class="mt-3 block w-full py-2 bg-amber-400 text-amber-900 text-center text-xs font-black uppercase tracking-widest rounded-lg hover:brightness-110 transition-colors">Resume Assessment</a>`;
                } else if (attempt.status === 'submitted') {
                     statusBtn = `<div class="mt-3 block w-full py-2 bg-indigo-500/50 text-indigo-100 text-center text-xs font-black uppercase tracking-widest rounded-lg">Awaiting Result</div>`;
                } else if (attempt.status === 'evaluated') {
                    statusBtn = `<div class="mt-3 flex items-center justify-between px-3 py-2 bg-indigo-900/50 rounded-lg">
                        <span class="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">Final Score</span>
                        <span class="text-sm font-black text-green-400">${attempt.score} / ${exam.total_marks}</span>
                    </div>`;
                }
            }

            return `
            <div class="bg-indigo-500/50 border border-indigo-400/50 p-3 rounded-xl mb-3 last:mb-0">
                <div class="flex items-center justify-between mb-1">
                    <span class="px-2 py-0.5 bg-indigo-900/50 text-indigo-200 text-[9px] font-bold uppercase tracking-widest rounded">${exam.subject}</span>
                    <span class="text-[10px] text-white/70 font-bold"><span class="material-symbols-outlined text-[12px] align-text-bottom">timer</span> ${exam.duration_minutes}m</span>
                </div>
                <h4 class="font-bold text-sm text-white mb-1.5 leading-tight">${exam.title}</h4>
                ${statusBtn}
            </div>
        `}).join('') + `
        <a href="my_exams.html" class="block text-center text-xs font-bold text-indigo-300 hover:text-white mt-4 uppercase tracking-widest transition-colors">
            Enter Assessment Hub <span class="material-symbols-outlined text-[14px] align-middle">arrow_forward</span>
        </a>`;

    } catch(err) {
        console.error("Exam load error:", err);
        list.innerHTML = `<p class="text-xs text-red-300 italic mt-6">Failed to verify assessment status.</p>`;
    }
}

async function loadStudentAnnouncements() {
    const list = document.getElementById('student-announcements-list');
    const container = document.getElementById('student-announcements');
    if (!list || !container) return;

    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) return;
        const studentId = session.user.id;

        // 1. Find assigned mentor
        const { data: mentors } = await window.supabase
            .from('mentorship_requests')
            .select('mentor_id')
            .eq('mentee_id', studentId)
            .eq('status', 'accepted');
        
        const mentorIds = mentors ? mentors.map(m => m.mentor_id) : [];

        // 2. Fetch announcements (Simple select first to ensure it works)
        const now = new Date().toISOString();
        const { data: anns, error } = await window.supabase
                .from('announcements')
                .select('*')
                .or(`target_role.eq.all,target_role.eq.student`)
                .or(`expires_at.is.null,expires_at.gt.${now}`)
                .order('created_at', { ascending: false })
                .limit(10);

        if (error) throw error;
        if (!anns || anns.length === 0) {
            container.classList.add('hidden');
            return;
        }

        // 3. Resolve author metadata manually to avoid join failures
        const authorIds = [...new Set(anns.map(a => a.author_id))];
        const { data: usersData } = await window.supabase
            .from('users')
            .select('id, name, role, email')
            .in('id', authorIds);
        
        const usersMap = {};
        if (usersData) usersData.forEach(u => usersMap[u.id] = u);

        // 4. Filter and Render
        const filtered = anns.filter(a => {
            const author = usersMap[a.author_id];
            if (!author) return false;
            if (author.role === 'faculty' || author.role === 'admin') return true;
            if (author.role === 'mentor' && mentorIds.includes(a.author_id)) return true;
            return false;
        });

        if (filtered.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        list.className = "grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[320px] overflow-y-auto pr-2 no-scrollbar scroll-smooth";
        list.innerHTML = filtered.map(a => {
            const author = usersMap[a.author_id] || { name: 'Unknown', role: 'system', email: '' };
            const isMentor = author.role === 'mentor';
            const color = isMentor ? 'indigo' : 'blue';
            return `
                <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all border-l-4 border-l-${color}-500 overflow-hidden relative group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span class="material-symbols-outlined text-6xl">${isMentor ? 'psychology' : 'school'}</span>
                    </div>
                    <div class="flex items-center gap-2 mb-3">
                        <img src="${window.getAvatarUrl(author.email, 32)}" class="size-6 rounded-full object-cover">
                        <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">${author.name}</span>
                        <span class="px-2 py-0.5 rounded-full bg-${color}-50 dark:bg-${color}-900/10 text-${color}-600 dark:text-${color}-400 text-[8px] font-black uppercase tracking-widest border border-${color}-100 dark:border-${color}-900/20">${author.role}</span>
                    </div>
                    <h4 class="font-black text-slate-900 dark:text-white mb-2 leading-tight">${a.title}</h4>
                    <p class="text-slate-600 dark:text-slate-300 text-xs leading-relaxed line-clamp-2">${a.body}</p>
                    <div class="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800/50 flex items-center justify-between">
                        <span class="text-[9px] font-bold text-slate-300 uppercase tracking-widest">${new Date(a.created_at).toLocaleDateString()}</span>
                        <button onclick="window.readFullAnnouncement('${a.id}', \`${a.title.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, \`${a.body.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)" class="text-[9px] font-black uppercase tracking-widest text-${color}-500 hover:underline">Read Full Broadcast</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Dashboard announcements failed:", err);
    }
}

window.readFullAnnouncement = function(id, title, body) {
    let modal = document.getElementById('announcement-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'announcement-modal';
        modal.className = 'fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div class="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                    <div class="size-10 bg-primary rounded-xl flex items-center justify-center text-white">
                        <span class="material-symbols-outlined">campaign</span>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-900 dark:text-white leading-tight">Broadcast Detail</h3>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Platform Alert</p>
                    </div>
                </div>
                <button onclick="this.closest('#announcement-modal').classList.add('hidden')" class="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all">
                    <span class="material-symbols-outlined">close</span>
                </button>
            </div>
            <div class="p-8 space-y-4">
                <h2 class="text-2xl font-black text-slate-900 dark:text-white leading-tight">${title}</h2>
                <div class="prose prose-slate dark:prose-invert max-w-none">
                    <p class="text-slate-600 dark:text-slate-300 leading-relaxed">${body}</p>
                </div>
            </div>
            <div class="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button onclick="this.closest('#announcement-modal').classList.add('hidden')" class="px-8 py-3 bg-primary text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:brightness-110 transition-all">Understood</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
};

// Initialize
initDashboard();
// ── 5. Community Hub (Forum) Logic ──────────────────────────────────────────
let studentBroadcastChannel = null;
let studentDbChannel = null;
let studentChatMentorId = null;

async function initStudentForum() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Find the mentor_id from accepted mentorship
    const { data: mentorReq, error } = await supabase
        .from('mentorship_requests')
        .select('mentor_id')
        .eq('mentee_id', session.user.id)
        .eq('status', 'accepted')
        .maybeSingle();

    if (error || !mentorReq) {
        console.log("No active mentor found for this student. Forum disabled.");
        return;
    }

    studentChatMentorId = mentorReq.mentor_id;
    const container = document.getElementById('student-forum-container');
    if (container) container.classList.remove('hidden');

    setupStudentChatListeners(session.user.id);
    loadStudentForumHistory();
}

async function setupStudentChatListeners(userId) {
    const form = document.getElementById('student-forum-form');
    if (!form) return;

    // WebSocket / Broadcast for instant messaging
    studentBroadcastChannel = supabase.channel(`chat_broadcast:${studentChatMentorId}`);
    studentBroadcastChannel
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
            renderStudentMessage(payload, false);
        })
        .subscribe();

    // DB listener for other mentees in the same group
    studentDbChannel = supabase.channel(`student_db:${userId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cohort_chats',
            filter: `mentor_id=eq.${studentChatMentorId}`
        }, ({ new: msg }) => {
            if (msg.sender_id === userId) return; // Own message already handled
            renderStudentMessage(msg, false);
        })
        .subscribe();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('student-forum-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        const msgObj = { sender_id: userId, message: text, mentor_id: studentChatMentorId };

        // Optimistic render
        renderStudentMessage(msgObj, true);

        // Broadcast
        if (studentBroadcastChannel) {
            studentBroadcastChannel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: { ...msgObj, sender_name: 'You' }
            });
        }

        // Persist
        await supabase.from('cohort_chats').insert(msgObj);
    });
}

async function loadStudentForumHistory() {
    const box = document.getElementById('student-forum-box');
    if (!box) return;

    const { data: msgs, error } = await supabase
        .from('cohort_chats')
        .select('*')
        .eq('mentor_id', studentChatMentorId)
        .order('created_at', { ascending: true })
        .limit(100);

    if (error) {
        box.innerHTML = `<div class="p-8 text-center text-red-400">Failed to load forum hostory.</div>`;
        return;
    }

    if (!msgs || msgs.length === 0) {
        box.innerHTML = `<div class="h-full flex items-center justify-center text-slate-400 text-sm italic">Welcome to the discussion! Your mentor and peers are here.</div>`;
        return;
    }

    box.innerHTML = '';
    msgs.forEach(m => renderStudentMessage(m, m.sender_id === (supabase.auth.getSession().then(({data}) => data.session?.user.id))));
    // The above line is tricky with async, let's simplify
    const { data: { session } } = await supabase.auth.getSession();
    box.innerHTML = msgs.map(m => createMessageHTML(m, m.sender_id === session?.user.id)).join('');
    box.scrollTop = box.scrollHeight;
}

function renderStudentMessage(m, isMe) {
    const box = document.getElementById('student-forum-box');
    if (!box) return;
    const placeholder = box.querySelector('.italic, .h-full');
    if (placeholder) box.innerHTML = '';
    
    box.insertAdjacentHTML('beforeend', createMessageHTML(m, isMe));
    box.scrollTop = box.scrollHeight;
}

function createMessageHTML(m, isMe) {
    const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
    if (isMe) {
        return `
            <div class="flex flex-col items-end w-full animate-in slide-in-from-right-2 duration-300">
                <div class="px-5 py-3 rounded-[24px] rounded-br-none bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none text-sm max-w-[80%] font-medium">
                    ${String(m.message).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
                </div>
                <span class="text-[9px] font-black text-slate-400 uppercase mt-1.5 mr-1">You • ${time}</span>
            </div>
        `;
    } else {
        return `
            <div class="flex flex-col items-start w-full animate-in slide-in-from-left-2 duration-300">
                <div class="px-5 py-3 rounded-[24px] rounded-bl-none bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm text-sm max-w-[80%] font-medium">
                    ${String(m.message).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
                </div>
                <span class="text-[9px] font-black text-slate-400 uppercase mt-1.5 ml-1">Peer • ${time}</span>
            </div>
        `;
    }
}

// Start
// initStudentForum(); // Removed as per dashboard cleanup policy

// Initialize everything else
initDashboard();
