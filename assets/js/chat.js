import { supabase } from '/assets/js/supabase-client.js';

let currentUser = null;
let activeMentorId = null;
let broadcastChannel = null;
let dbChannel = null;
const usersCache = {}; // { id: { name, email } }
let activeDoubtSessionId = null;
let currentMentorMessages = []; // Cache for filtering

window.sendMessageToRoom = async function(text) {
    if (!activeMentorId || !currentUser) return;
    
    // For 1:1, we often prefix DM|recipient| if it's a private chat
    // But for system markers, we just send as is.
    const isSystem = text.startsWith('DM|') || 
                     text.startsWith('SYSTEM_VOTE|') || 
                     text.startsWith('SYSTEM_DOUBT_START|') || 
                     text.startsWith('SYSTEM_DOUBT_END|');

    const finalMsg = isSystem ? text : `DM|${activeMentorId}|${text}`;

    const { data: inserted, error } = await supabase.from('cohort_chats').insert({
        mentor_id: activeMentorId,
        sender_id: currentUser.id,
        message: finalMsg
    }).select().single();

    if (error) {
        console.error("Send error:", error);
        return;
    }

    if (broadcastChannel) {
        broadcastChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: { 
                ...inserted,
                sender_name: usersCache[currentUser.id]?.name || 'Student',
                sender_email: currentUser.email
            }
        });
    }
};

// ── Helpers ──────────────────────────────────────────────────────────────
async function preloadNames(ids) {
    const missing = ids.filter(id => !usersCache[id]);
    if (!missing.length) return;
    const { data } = await supabase.from('users').select('id, name, email').in('id', missing);
    if (data) data.forEach(u => usersCache[u.id] = { name: u.name, email: u.email });
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bubble(m, isMe) {
    const isMentor = m.sender_id === m.mentor_id;
    const userData = usersCache[m.sender_id] || { name: (isMentor ? 'Mentor' : 'Student'), email: '' };
    const name = isMe ? 'You' : userData.name;
    const id = m.id ? `data-id="${m.id}"` : 'data-temp="true"';
    
    let rawMsg = m.message || '';
    if (rawMsg.startsWith('DM|')) {
        const parts = rawMsg.split('|');
        rawMsg = parts.slice(2).join('|');
    }

    // Detection for YouTube / Poll feature
    let content = esc(rawMsg);
    let extraCard = '';
    let isRich = false;

    if (rawMsg && rawMsg.startsWith('YT_VIDEO|')) {
        const parts = rawMsg.split('|');
        const topic = esc(parts[1] || 'Unknown Topic');
        const url = parts[2] || '';
        const videoId = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/)?.[1];
        
        if (videoId) {
            isRich = true;
            content = `<div class="font-black text-[10px] uppercase tracking-widest ${isMe?'text-white/70':'text-indigo-400'} mb-1">Educational Resource</div><div class="font-bold text-sm mb-2 ${isMe?'text-white':'text-slate-800 dark:text-white'}">${topic}</div>`;
            extraCard = `
                <div class="mt-3 rounded-xl overflow-hidden shadow-lg bg-black aspect-video relative group">
                    <iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>
                </div>
                <a href="${url}" target="_blank" class="mt-2 block text-[9px] font-black uppercase tracking-widest ${isMe?'text-indigo-200 hover:text-white':'text-indigo-500 hover:text-indigo-600'} underline transition-colors">Open in YouTube <span class="material-symbols-outlined text-[10px] align-middle">open_in_new</span></a>
            `;
        }
    } else if (rawMsg && rawMsg.startsWith('POLL|')) {
        isRich = true;
        const parts = rawMsg.split('|');
        const topic = esc(parts[1] || 'Community Poll');
        const options = parts[2] ? parts[2].split(',') : [];
        content = `<div class="font-black text-[10px] uppercase tracking-widest ${isMe?'text-white/70':'text-indigo-400'} mb-1">Live Poll</div><div class="font-bold text-sm mb-3 poll-card-topic ${isMe?'text-white':'text-slate-800 dark:text-white'}">${topic}</div>`;
        extraCard = '<div class="space-y-2 mt-2">' + options.map((opt, idx) => `
            <button class="w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${isMe?'border-indigo-400/30 hover:bg-indigo-500/50':'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'} flex items-center justify-between group poll-opt-btn" data-opt="${esc(opt)}" data-opt-idx="${idx}" onclick="window.castVote(this)">
                <div class="flex items-center">
                    <span>${esc(opt)}</span>
                    <span class="vote-badge"></span>
                </div>
                <span class="size-4 rounded-full border ${isMe?'border-indigo-300':'border-slate-300'} group-hover:bg-indigo-400/20 flex items-center justify-center transition-colors mark-circle"></span>
            </button>
        `).join('') + '</div><p class="text-[9px] font-bold mt-3 opacity-70 italic tracking-wide">Select an option to vote</p>';
    } else if (rawMsg && (rawMsg.includes('SYSTEM_DOUBT_START|') || rawMsg.includes('SYSTEM_DOUBT_END|'))) {
        const parts = rawMsg.split('|');
        const isStart = rawMsg.includes('SYSTEM_DOUBT_START');
        const topic = esc(parts[1] || 'Academic Discussion');
        const sessId = parts[2] ? parts[2].substring(0, 8) : '...';
        
        const cardColor = isStart ? 'border-primary' : 'border-emerald-500';
        const icon = isStart ? 'rocket_launch' : 'task_alt';
        const label = isStart ? 'Discussion Initiated' : 'Doubt Cleared';
        const subtext = isStart ? 'Tracking Sheet Filed' : 'Academic Log Finalized';
        const authorLine = isMe ? 'You' : esc(userData.name);

        return `<div class="flex justify-center w-full my-4 msg-bubble" ${id} data-msg="${esc(rawMsg)}">
            <div class="bg-white dark:bg-slate-900 border-2 ${cardColor} rounded-2xl p-5 shadow-lg max-w-[420px] w-full text-center relative overflow-hidden">
                <div class="absolute top-0 right-0 p-3 opacity-10"><span class="material-symbols-outlined text-4xl">${icon}</span></div>
                <div class="flex items-center justify-center gap-2 mb-2">
                    <span class="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">${label}</span>
                </div>
                <h4 class="text-base font-black text-slate-900 dark:text-white leading-tight">"${topic}"</h4>
                <div class="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <div class="text-left leading-tight">
                        <p class="text-[9px] font-black text-slate-300 uppercase tracking-widest">${subtext}</p>
                        <p class="text-[11px] font-black text-primary uppercase tracking-widest mt-0.5">ID: ${sessId}</p>
                    </div>
                    <div class="flex items-center gap-1.5 grayscale opacity-50">
                        <img src="${window.getAvatarUrl(userData.email, 24)}" class="size-4 rounded-full">
                        <span class="text-[9px] font-bold text-slate-500">${authorLine}</span>
                    </div>
                </div>
            </div>
        </div>`;
    } else if (rawMsg && rawMsg.startsWith('SYSTEM_VOTE|')) {
        const parts = rawMsg.split('|');
        const topic = esc(parts[1]);
        const opt = esc(parts[2]);
        const action = esc(parts[3] || 'voted for');
        
        return `<div class="flex justify-center w-full my-2 msg-bubble" ${id} data-msg="${esc(rawMsg)}" data-sender-name="${esc(userData.name)}">
            <span class="text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 max-w-[90%] text-center leading-tight">
                ${isMe ? 'You' : esc(userData.name)} ${action} <span class="text-indigo-500 dark:text-indigo-400">"${opt}"</span> in <span class="opacity-80">${topic}</span>
            </span>
        </div>`;
    }

    const avatar = window.getAvatarUrl(userData.email, 40);

    if (isMe) {
        return `<div class="flex flex-col items-end w-full msg-bubble" ${id} data-msg="${esc(rawMsg)}">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] font-bold text-slate-400">You</span>
                <img src="${window.getAvatarUrl(currentUser.email, 24)}" class="size-5 rounded-full object-cover border border-slate-200" alt="You">
            </div>
            <div class="px-4 py-2.5 rounded-2xl rounded-tr-none ${isRich ? 'bg-indigo-600 max-w-[85%]' : 'bg-primary max-w-[75%]'} text-white shadow-sm text-sm msg-body">
                ${content}${extraCard}
            </div>
        </div>`;
    }

    const bg = isMentor
        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 dark:bg-indigo-900/20 dark:border-indigo-700 dark:text-indigo-200'
        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    const badge = isMentor ? `<span class="ml-1.5 bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black uppercase">Mentor</span>` : '';
    
    return `<div class="flex flex-col items-start w-full msg-bubble" ${id} data-msg="${esc(rawMsg)}">
        <div class="flex items-center gap-2 mb-1">
            <img src="${avatar}" class="size-6 rounded-full object-cover border border-slate-100" alt="${esc(userData.name)}">
            <span class="text-[10px] font-bold ${isMentor ? 'text-indigo-500' : 'text-slate-400'}">${esc(name)}</span>${badge}
        </div>
        <div class="px-4 py-2.5 rounded-2xl rounded-tl-none border ${bg} ${isRich ? 'max-w-[85%]' : 'max-w-[75%]'} shadow-sm text-sm msg-body">
            ${content}${extraCard}
        </div>
    </div>`;
}

function scrollBottom(box) { if (box) box.scrollTop = box.scrollHeight; }

let userRole = null;
let activeMentorName = null;

// ── Init ─────────────────────────────────────────────────────────────────
async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    currentUser = session.user;
    
    // Fetch profile to get role
    const { data: profile } = await supabase.from('users').select('role').eq('id', currentUser.id).single();
    userRole = profile?.role || 'student';
    
    usersCache[currentUser.id] = { name: 'You', email: currentUser.email };

    await loadMentors();
    setupInput();
    setupMobileView();
}

// ── Mobile View Management ──────────────────────────────────────────────
function setupMobileView() {
    const sidebar = document.getElementById('conversations-sidebar');
    const backBtn = document.getElementById('chat-back-btn');
    const collapseBtn = document.getElementById('collapse-sidebar-btn');
    
    if (!sidebar) return;

    let isSidebarCollapsed = false;

    const updateView = () => {
        const chatMain = document.getElementById('chat-main-area');
        const isMobile = window.innerWidth < 1024;
        
        if (isMobile) {
            // Mobile Logic: Mutual Exclusivity
            if (isSidebarCollapsed) {
                sidebar.classList.add('hidden');
                if (chatMain) chatMain.classList.remove('hidden');
                if (backBtn) backBtn.querySelector('.material-symbols-outlined').textContent = 'arrow_back';
            } else {
                sidebar.classList.remove('hidden');
                sidebar.classList.add('w-full');
                if (chatMain) chatMain.classList.add('hidden');
                // isSidebarCollapsed = false; // Don't force reset here, let it be controlled by buttons
            }
        } else {
            // Desktop Logic: Collapsible Sidebar
            sidebar.classList.remove('hidden', 'w-full');
            if (chatMain) chatMain.classList.remove('hidden');
            
            if (isSidebarCollapsed) {
                sidebar.style.width = '0px';
                sidebar.style.borderRightWidth = '0px';
                sidebar.style.overflow = 'hidden';
                if (backBtn) backBtn.querySelector('.material-symbols-outlined').textContent = 'menu';
            } else {
                sidebar.style.width = '320px'; // w-80
                sidebar.style.borderRightWidth = '1px';
                sidebar.style.overflow = '';
                if (backBtn) backBtn.querySelector('.material-symbols-outlined').textContent = 'menu_open';
            }
        }
    };

    window.addEventListener('resize', updateView);
    updateView();

    if (backBtn) {
        backBtn.onclick = () => {
            isSidebarCollapsed = false;
            updateView();
        };
    }

    if (collapseBtn) {
        collapseBtn.onclick = () => {
            isSidebarCollapsed = true;
            updateView();
        };
    }
    
    window.updateChatMobileView = () => {
        if (window.innerWidth < 1024) isSidebarCollapsed = true; 
        updateView();
    };
}

// ── Load mentors sidebar with Status Filtering ──
async function loadMentors() {
    const list = document.getElementById('chat-conversations-list');
    if (!list) return;

    // 1. Fetch ALL requests involving the user
    let query = supabase.from('mentorship_requests').select('*');
    if (userRole === 'mentor') {
        query = query.eq('mentor_id', currentUser.id);
    } else {
        query = query.eq('mentee_id', currentUser.id);
    }
    
    const { data: allRequests, error } = await query;
    if (error) {
        console.error("Fetch requests failed:", error);
        return;
    }

    if (!allRequests?.length) {
        list.innerHTML = `<div class="p-4 text-xs text-slate-500 italic text-center">No connection history found.</div>`;
        return;
    }

    // 2. Fetch associated user profiles
    const otherPartyIds = allRequests.map(r => userRole === 'mentor' ? r.mentee_id : r.mentor_id);
    const { data: profiles } = await supabase.from('users').select('id, name, email, role').in('id', otherPartyIds);
    if (profiles) profiles.forEach(u => usersCache[u.id] = { name: u.name, email: u.email, role: u.role });

    // 3. Fetch latest doubt sessions (only for accepted rooms)
    const { data: sessions } = await supabase
        .from('mentorship_doubt_sessions')
        .select('*')
        .or(`student_id.eq.${currentUser.id},mentor_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

    // 4. Render function
    window.renderMentorList = function(statusType = 'connections') {
        const list = document.getElementById('chat-conversations-list');
        if (!list) return;

        if (statusType === 'connections') {
            const items = [];
            allRequests.forEach(req => {
                const otherId = userRole === 'mentor' ? req.mentee_id : req.mentor_id;
                const profile = profiles?.find(p => p.id === otherId);
                if (profile) items.push({ req, profile });
            });

            if (items.length === 0) {
                list.innerHTML = `<div class="p-8 text-center opacity-40"><p class="text-[10px] font-bold uppercase tracking-widest">No connections found</p></div>`;
                return;
            }

            list.innerHTML = items.map(({ req, profile }) => {
                const dateDecision = req.updated_at ? new Date(req.updated_at).toLocaleDateString() : (req.created_at ? new Date(req.created_at).toLocaleDateString() : '');
                const dot = req.status === 'accepted' ? 'bg-emerald-500' : (req.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-red-300');
                
                return `
                    <div onclick="handleConnectionSelect('${profile.id}', '${esc(profile.name)}', '${req.status}')"
                         id="conn-${profile.id}"
                         class="p-4 bg-white hover:bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all group ${activeMentorId === profile.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}">
                        <div class="flex items-start gap-3">
                            <div class="relative shrink-0">
                                <img src="${window.getAvatarUrl(profile.email, 64)}" class="size-11 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm">
                                <span class="absolute bottom-0 right-0 size-3 ${dot} rounded-full border-2 border-white dark:border-slate-800 shadow-sm"></span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[13px] font-black text-slate-900 dark:text-white truncate">${esc(profile.name)}</p>
                                <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">${profile.role} • ${dateDecision}</p>
                                <div class="flex items-center gap-2 mt-1.5">
                                    <span class="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">${req.status}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            return;
        }

        // For Active / Solved: Show D डाउट्स for the SELECTED mentor
        if (!activeMentorId) {
            list.innerHTML = `<div class="p-12 text-center opacity-40">
                <span class="material-symbols-outlined text-4xl mb-2 text-primary">person_search</span>
                <p class="text-[10px] font-black uppercase tracking-[0.2em]">Select a mentor from Connections</p>
            </div>`;
            return;
        }

        const filteredSessions = (sessions || []).filter(s => {
            const isMatch = (s.mentor_id === activeMentorId || s.student_id === activeMentorId);
            if (!isMatch) return false;
            return statusType === 'active' ? s.mentee_status === 'open' : s.mentee_status === 'completed';
        });

        if (filteredSessions.length === 0) {
            list.innerHTML = `<div class="p-12 text-center opacity-30">
                <p class="text-[10px] font-black uppercase tracking-widest leading-relaxed">No ${statusType} doubts found for <br>${activeMentorName}</p>
            </div>`;
            return;
        }

        list.innerHTML = filteredSessions.map(s => {
            const date = new Date(s.mentee_date || s.created_at).toLocaleDateString();
            const urgency = (new Date() - new Date(s.created_at)) / (1000 * 60 * 60);
            const dot = statusType === 'solved' ? 'bg-emerald-500' : (urgency > 48 ? 'bg-red-500 animate-pulse' : 'bg-green-400');

            return `
                <div onclick="selectDoubtSession('${s.id}')"
                     class="p-4 bg-white hover:bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all group">
                    <div class="flex items-start gap-3">
                        <div class="size-2 shrink-0 ${dot} rounded-full mt-2"></div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-center mb-0.5">
                                <p class="text-[13px] font-black text-slate-800 dark:text-white truncate">"${esc(s.mentee_needs)}"</p>
                                <span class="text-[9px] font-bold text-slate-400 shrink-0 ml-2">${date}</span>
                            </div>
                            <p class="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">forum</span> Discussion ID: ${s.id.substring(0,8)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    window.handleConnectionSelect = function(id, name, status) {
        if (status !== 'accepted') return alert("Connection is " + status);
        selectMentorRoom(id, name);
        // Switch to Active tab to show doubts? Optional but helpful
        // document.getElementById('tab-active-btn').click(); 
    };

    window.selectDoubtSession = async function(sessionId) {
        activeDoubtSessionId = sessionId;
        const session = (sessions || []).find(s => s.id === sessionId);
        
        // Update Header to show focused topic
        const headerName = document.getElementById('active-chat-name');
        if (headerName && session) {
            headerName.innerHTML = `
                <div class="flex flex-col">
                    <span class="text-[10px] uppercase tracking-widest text-primary font-black opacity-70">Focusing on Doubt</span>
                    <span class="text-sm font-black text-slate-900 dark:text-white">"${esc(session.mentee_needs)}"</span>
                </div>
            `;
        }

        const chatView = document.getElementById('chat-messages-view');
        const emptyView = document.getElementById('no-chat-selected');
        chatView?.classList.remove('hidden');
        emptyView?.classList.add('hidden');
        
        // Filter the existing message cache
        const box = document.getElementById('chat-messages');
        renderChatWithFilters(box);

        await checkDoubtSessionStatus();
    };

    // Initial render
    window.renderMentorList('connections');
    setupDoubtLogic();
}

let currentSession = null;

async function setupDoubtLogic() {
    const trigger = document.getElementById('trigger-doubt-modal');
    const modal = document.getElementById('doubt-modal');
    const form = document.getElementById('doubt-init-form');

    if (trigger) trigger.onclick = () => {
        modal.classList.remove('hidden');
        document.getElementById('doubt-date').valueAsDate = new Date();
    };

    const closer = document.getElementById('close-doubt-modal');
    if (closer) closer.onclick = () => {
        modal.classList.add('hidden');
    };

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const btn = form.querySelector('button[type="submit"]');

            // Remove any old error messages
            const oldErr = form.querySelector('.track-error-inline');
            if (oldErr) oldErr.remove();

            if (!activeMentorId) {
                const errBox = document.createElement('div');
                errBox.className = 'track-error-inline bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center mb-4';
                errBox.innerText = 'Error: No active mentor selected. Please close and re-select a mentor.';
                form.insertBefore(errBox, btn);
                return;
            }

            btn.disabled = true;
            btn.innerText = 'Syncing Audit Flow...';

            try {
                // 1. Fetch Full Academic Snapshots from Registry
                const { data: mentee, error: menteeErr } = await supabase.from('users').select('*').eq('id', currentUser.id).single();
                const { data: mentor, error: mentorErr } = await supabase.from('users').select('*').eq('id', activeMentorId).single();
                
                if (menteeErr) console.warn("Mentee profile snap failed:", menteeErr);
                if (mentorErr) console.warn("Mentor profile snap failed:", mentorErr);

                const payload = {
                    student_id: currentUser.id,
                    mentor_id: activeMentorId,
                    mentee_date: document.getElementById('doubt-date').value,
                    mentee_mode: document.getElementById('doubt-mode').value,
                    mentee_needs: document.getElementById('doubt-needs').value,
                    mentee_support_requested: document.getElementById('doubt-support').value,
                    mentee_duration: document.getElementById('doubt-duration').value,
                    mentee_next_date: document.getElementById('doubt-next-date').value || null,
                    mentee_status: 'open',

                    // Academic Metadata Snapshots (Direct mapping to users table)
                    mentee_name: mentee?.name || currentUser.email,
                    mentee_email: mentee?.email || currentUser.email,
                    mentee_reg_no: mentee?.register_number || 'N/A',
                    mentee_branch: mentee?.branch || 'GENERAL',
                    mentee_year: mentee?.year || '—',
                    mentee_section: mentee?.section || '—',
                    mentee_faculty_advisor: mentee?.faculty_advisor || mentee?.assigned_faculty || 'Unassigned',

                    mentor_name: mentor?.name || 'Peer Mentor',
                    mentor_email: mentor?.email || '',
                    mentor_reg_no: mentor?.register_number || 'N/A',
                    mentor_branch: mentor?.branch || 'MENTOR_HUB',
                    mentor_year: mentor?.year || '—',
                    mentor_section: mentor?.section || '—',
                    mentor_faculty_advisor: mentor?.faculty_advisor || mentor?.assigned_faculty || 'Unassigned'
                };

                const { data: sessionObj, error } = await supabase.from('mentorship_doubt_sessions').insert([payload]).select().single();
                if (error) throw error;

                currentSession = sessionObj;
                modal.classList.add('hidden');
                
                // 3. System Message to notify everyone
                const sysMsg = `SYSTEM_DOUBT_START|${payload.mentee_needs}|${sessionObj.id}`;
                await window.sendMessageToRoom(sysMsg);
                
                await checkDoubtSessionStatus();
                
                // Force a full UI thread re-render to guarantee the system marker aligns correctly matching the remote DB state
                await loadMentors();

                if (activeMentorId) {
                    await window.selectMentorRoom(activeMentorId, activeMentorName);
                    setTimeout(() => {
                        const btn = document.getElementById('tab-active-btn');
                        if (btn) btn.click();
                        else window.renderMentorList('active');
                    }, 50);
                }
                
                // Cleanup UI
                btn.disabled = false;
                btn.innerText = 'Submit Tracking & Start Chat';
                form.reset();
                
            } catch (err) {
                console.error("Session start error:", err);
                
                const errBox = document.createElement('div');
                errBox.className = 'track-error-inline bg-red-100 text-red-600 p-3 rounded-lg text-xs font-bold text-center mt-2 border border-red-200';
                errBox.innerText = "Audit Failed: " + err.message;
                form.insertBefore(errBox, btn);

                btn.disabled = false;
                btn.innerText = 'Submit Tracking & Start Chat';
            }
        };
    }
}

async function checkDoubtSessionStatus() {
    if (!activeMentorId || !currentUser) return;
    
    const blocker = document.getElementById('chat-blocker');
    const controls = document.getElementById('session-controls');
    const chatInput = document.getElementById('chat-input');

    let query = supabase
        .from('mentorship_doubt_sessions')
        .select('*')
        .eq('student_id', currentUser.id)
        .eq('mentor_id', activeMentorId)
        .eq('mentee_status', 'open');

    if (activeDoubtSessionId) {
        query = query.eq('id', activeDoubtSessionId);
    }

    const { data: session } = await query.maybeSingle();

    if (session) {
        currentSession = session;
        if (blocker) blocker.classList.add('hidden');
        if (controls) controls.classList.remove('hidden');
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = `Message ${activeMentorName || 'Mentor'}...`;
        }
    } else {
        currentSession = null;
        if (blocker) blocker.classList.remove('hidden');
        if (controls) controls.classList.add('hidden');
        if (chatInput) {
            chatInput.disabled = true;
            chatInput.placeholder = "Doubt session ended or not initiated.";
        }
    }
}

// ── Open a mentor's room ─────────────────────────────────────────────────
window.selectMentorRoom = async function(mentorId, mentorName) {
    activeMentorId = mentorId;
    activeMentorName = mentorName;
    activeDoubtSessionId = null; // Reset filter when switching mentors
    
    // Trigger mobile view update
    if (window.updateChatMobileView) window.updateChatMobileView();

    await checkDoubtSessionStatus();

    const headerName = document.getElementById('active-chat-name');
    if (headerName) headerName.textContent = mentorName + "'s Forum";

    const box = document.getElementById('chat-messages');
    if (box) box.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400 text-xs gap-3 flex-col"><div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>Loading History...</div>';

    // Tear down previous channels
    if (broadcastChannel) { await supabase.removeChannel(broadcastChannel); broadcastChannel = null; }
    if (dbChannel) { await supabase.removeChannel(dbChannel); dbChannel = null; }

    // ── BROADCAST channel ─────────────────────────────────────────────
    broadcastChannel = supabase.channel(`chat_broadcast:${mentorId}`, {
        config: { broadcast: { self: false } }
    });

    broadcastChannel
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
            receiveMessage(payload);
        })
        .subscribe();

    // ── DB CHANGES channel ──────────────────────────────────────────
    dbChannel = supabase.channel(`chat_db:${mentorId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cohort_chats',
            filter: `mentor_id=eq.${mentorId}`
        }, ({ new: msg }) => {
            if (box.querySelector(`[data-id="${msg.id}"]`)) return;
            receiveMessage(msg);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'mentorship_doubt_sessions',
            filter: `student_id=eq.${currentUser.id}`
        }, () => {
            // Real-time status sync for the "End Session" button
            checkDoubtSessionStatus();
        })
        .subscribe();

    // Fetch history
    const { data: messages } = await supabase
        .from('cohort_chats')
        .select('*')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: true })
        .limit(1000);

    const msgs = (messages || []).filter(m => {
        const isSystem = m.message?.includes('SYSTEM_VOTE|') || 
                         m.message?.includes('SYSTEM_DOUBT_START|') || 
                         m.message?.includes('SYSTEM_DOUBT_END|');
        
        if (m.sender_id === currentUser.id) return true;
        if (m.sender_id === mentorId) {
            if (isSystem) return true;
            return m.message && m.message.startsWith(`DM|${currentUser.id}|`);
        }
        return false;
    });

    const needed = [...new Set(msgs.map(m => m.sender_id))].filter(id => !usersCache[id]);
    if (needed.length > 0) {
        const { data: uInfo } = await supabase.from('users').select('id, name, email').in('id', needed);
        if (uInfo) uInfo.forEach(u => usersCache[u.id] = { name: u.name, email: u.email });
    }

    if (box) {
        currentMentorMessages = msgs; // Save for local session filtering
        renderChatWithFilters(box);
        updateResourcesList();
        updatePollVotes();
    }
};

function renderChatWithFilters(box) {
    if (!box) box = document.getElementById('chat-messages');
    if (!box) return;

    let displayMsgs = currentMentorMessages;

    if (activeDoubtSessionId) {
        // Find the start marker for this session
        const startIndex = currentMentorMessages.findIndex(m => 
            m.message && m.message.startsWith('SYSTEM_DOUBT_START|') && m.message.includes(`|${activeDoubtSessionId}`)
        );

        if (startIndex !== -1) {
            // Find the next session marker
            let endIndex = currentMentorMessages.findIndex((m, idx) => 
                idx > startIndex && m.message && m.message.startsWith('SYSTEM_DOUBT_START|')
            );
            
            if (endIndex === -1) endIndex = currentMentorMessages.length;
            displayMsgs = currentMentorMessages.slice(startIndex, endIndex);
        }
    }

    box.innerHTML = '';
    if (displayMsgs.length === 0) {
        box.innerHTML = '<div class="h-full flex items-center justify-center text-slate-400 text-xs flex-col chat-placeholder">No messages in this thread yet.</div>';
    } else {
        displayMsgs.forEach(msg => {
            box.insertAdjacentHTML('beforeend', bubble(msg, msg.sender_id === currentUser.id));
        });
    }
    scrollBottom(box);
}

window.updatePollVotes = function() {
    const box = document.getElementById('chat-messages');
    if (!box) return;

    const votes = {}; // { "Topic": { "Opt": Set("User1") } }
    let hasVotes = false;

    box.querySelectorAll('.msg-bubble').forEach(el => {
        const rawMsg = el.getAttribute('data-msg') || '';
        if (rawMsg.startsWith('SYSTEM_VOTE|')) {
            const parts = rawMsg.split('|');
            const topic = parts[1];
            const opt = parts[2];
            const action = parts[3];
            const optIdx = parts[4];
            const senderName = el.getAttribute('data-sender-name') || 'User';

            if (!votes[topic]) votes[topic] = {};
            const key = optIdx !== undefined ? `${optIdx}_${opt}` : opt;
            if (!votes[topic][key]) votes[topic][key] = new Set();

            if (action === 'voted for') {
                votes[topic][key].add(senderName);
            } else {
                votes[topic][key].delete(senderName);
            }
            hasVotes = true;
        }
    });

    if (!hasVotes) return;

    box.querySelectorAll('.poll-card-topic').forEach(topicEl => {
        const topic = topicEl.innerText;
        const parentBtnArea = topicEl.nextElementSibling;
        if (!parentBtnArea) return;
        
        parentBtnArea.querySelectorAll('.poll-opt-btn').forEach(btn => {
            const optName = btn.getAttribute('data-opt');
            const optIdx = btn.getAttribute('data-opt-idx');
            const key = optIdx !== null ? `${optIdx}_${optName}` : optName;
            const badge = btn.querySelector('.vote-badge');
            const voters = votes[topic]?.[key];

            if (voters && voters.size > 0) {
                const names = Array.from(voters).join(', ');
                badge.innerHTML = `<span class="text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md ml-2">${voters.size} (${names})</span>`;
            } else {
                badge.innerHTML = '';
            }
        });
    });
};

function updateResourcesList() {
    const box = document.getElementById('chat-messages');
    const list = document.getElementById('resources-content-list');
    if (!box || !list) return;

    const resources = [];
    box.querySelectorAll('.msg-bubble').forEach(el => {
        const msg = el.getAttribute('data-msg') || '';
        if (msg.startsWith('YT_VIDEO|')) {
            const p = msg.split('|');
            resources.push({ type: 'YT', topic: p[1] || 'Video', url: p[2] });
        } else if (msg.startsWith('POLL|')) {
            const p = msg.split('|');
            resources.push({ type: 'POLL', topic: p[1] || 'Poll Forum', opts: p[2] ? p[2].split(',').length : 0 });
        }
    });

    if (resources.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-400 italic">No resources or polls shared yet.</p>';
        return;
    }

    list.innerHTML = resources.map(r => {
        if (r.type === 'YT') {
            return `
                <a href="${esc(r.url)}" target="_blank" class="block p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 transition-colors group">
                    <div class="flex gap-2">
                        <div class="size-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">play_circle</span></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">${esc(r.topic)}</p>
                            <p class="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-black">Video Resource</p>
                        </div>
                    </div>
                </a>
            `;
        } else {
            return `
                <div class="p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10">
                    <div class="flex gap-2 mb-2">
                        <div class="size-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">poll</span></div>
                        <div>
                            <p class="text-xs font-bold text-slate-800 dark:text-slate-200">${esc(r.topic)}</p>
                            <p class="text-[10px] text-indigo-400 mt-1 uppercase tracking-widest font-black">Live Poll - ${r.opts} Options</p>
                        </div>
                    </div>
                </div>
            `;
        }
    }).reverse().join('');
}

// ── Receive message (Broadcast or DB) ─────────────────────────────────────
async function receiveMessage(payload) {
    const box = document.getElementById('chat-messages');
    if (!box || payload.mentor_id !== activeMentorId) return;

    // Reject messages that are not meant for this 1:1 room
    const isSystem = payload.message?.includes('SYSTEM_VOTE|') || 
                     payload.message?.includes('SYSTEM_DOUBT_START|') || 
                     payload.message?.includes('SYSTEM_DOUBT_END|');

    if (payload.sender_id !== currentUser.id && !isSystem) {
        if (!payload.message || !payload.message.startsWith(`DM|${currentUser.id}|`)) return;
    }

    if (!usersCache[payload.sender_id]) {
        if (payload.sender_name && payload.sender_email) {
            usersCache[payload.sender_id] = { name: payload.sender_name, email: payload.sender_email };
        } else {
            const { data: u } = await supabase.from('users').select('name, email').eq('id', payload.sender_id).single();
            usersCache[payload.sender_id] = { name: u?.name || 'Student', email: u?.email || '' };
        }
    }

    const placeholder = box.querySelector('.text-center, .h-full');
    if (placeholder) placeholder.remove();

    if (box.querySelector(`[data-id="${payload.id}"]`)) return;

    currentMentorMessages.push(payload);

    box.insertAdjacentHTML('beforeend', bubble(payload, payload.sender_id === currentUser.id));
    scrollBottom(box);
    updateResourcesList();
    updatePollVotes();

    if (payload.message && payload.message.includes('SYSTEM_DOUBT_END|')) {
        await checkDoubtSessionStatus();
        await loadMentors();
        
        const solvedTab = document.getElementById('tab-solved-btn');
        const activeTab = document.getElementById('tab-active-btn');
        
        if (solvedTab && solvedTab.classList.contains('border-primary')) {
            window.renderMentorList('solved');
        } else if (activeTab && activeTab.classList.contains('border-primary')) {
            window.renderMentorList('active');
        } else {
            window.renderMentorList('connections');
        }
    }
}

window.castVote = async function(btn) {
    const parent = btn.parentElement;
    const isAlreadySelected = btn.classList.contains('bg-indigo-50');

    parent.querySelectorAll('button').forEach(b => {
        b.classList.remove('bg-indigo-50', 'dark:bg-indigo-900/40', 'border-indigo-500');
        const r = b.querySelector('.mark-circle') || b.querySelector('span:last-child');
        if (r) {
            r.classList.remove('bg-indigo-500', 'border-indigo-500');
            r.innerHTML = '';
        }
    });

    if (!isAlreadySelected) {
        btn.classList.add('bg-indigo-50', 'dark:bg-indigo-900/40', 'border-indigo-500');
        const radio = btn.querySelector('.mark-circle') || btn.querySelector('span:last-child');
        if (radio) {
            radio.classList.add('bg-indigo-500', 'border-indigo-500');
            radio.innerHTML = '<span class="material-symbols-outlined text-[10px] text-white font-black">check</span>';
        }
    }

    if (!activeMentorId) return;
    const bubbleNode = btn.closest('.msg-bubble');
    const rawMsg = bubbleNode ? bubbleNode.getAttribute('data-msg') : '';
    const parts = rawMsg.split('|');
    const topic = parts[1] || 'Poll';
    const spanTextNode = btn.querySelector('div span:first-child') || btn.querySelector('span');
    const optName = spanTextNode.innerText;
    const optIdx = btn.getAttribute('data-opt-idx') || Array.from(parent.querySelectorAll('button')).indexOf(btn);
    const action = isAlreadySelected ? 'removed vote from' : 'voted for';
    
    const textMsg = `SYSTEM_VOTE|${topic}|${optName}|${action}|${optIdx}`;
    
    const myData = usersCache[currentUser.id] || {};
    const msgObj = { 
        sender_id: currentUser.id, 
        message: textMsg, 
        mentor_id: activeMentorId,
        sender_name: myData.name,
        sender_email: myData.email
    };

    const box = document.getElementById('chat-messages');
    if (box) {
        const placeholder = box.querySelector('.text-center, .h-full');
        if (placeholder) placeholder.remove();
        box.insertAdjacentHTML('beforeend', bubble(msgObj, true));
        scrollBottom(box);
        updatePollVotes();
    }

    if (broadcastChannel) {
        broadcastChannel.send({
            type: 'broadcast',
            event: 'new_message',
            payload: msgObj
        });
    }

    await supabase.from('cohort_chats').insert({
        mentor_id: activeMentorId,
        sender_id: currentUser.id,
        message: textMsg
    });
};

// ── Send message ──────────────────────────────────────────────────────────
function setupInput() {
    const form = document.getElementById('chat-form');
    if (!form) return;

    const submit = async () => {
        if (!activeMentorId) return;
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';

        const box = document.getElementById('chat-messages');
        const myData = usersCache[currentUser.id];
        const msgObj = { 
            sender_id: currentUser.id, 
            message: text, 
            mentor_id: activeMentorId,
            sender_name: myData.name,
            sender_email: myData.email
        };

        if (box) {
            const placeholder = box.querySelector('.text-center, .h-full');
            if (placeholder) placeholder.remove();
            box.insertAdjacentHTML('beforeend', bubble(msgObj, true));
            scrollBottom(box);
            updateResourcesList();
            updatePollVotes();
        }

        if (broadcastChannel) {
            broadcastChannel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: msgObj
            });
        }

        // 3. Persist to DB (async, for history + faculty monitoring)
        const { error } = await supabase.from('cohort_chats').insert({
            mentor_id: activeMentorId,
            sender_id: currentUser.id,
            message: text
        });
        if (error) console.error('Chat insert error:', error);
    };

    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    document.getElementById('chat-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    // YouTube Share Logic
    const ytBtn = document.getElementById('yt-share-btn');
    const ytModal = document.getElementById('yt-modal');
    const ytForm = document.getElementById('yt-share-form');
    const ytCancel = document.getElementById('yt-cancel');

    if (ytBtn && ytModal) {
        ytBtn.onclick = () => {
            if (!activeMentorId) return alert("Select a forum first.");
            ytModal.classList.remove('hidden');
        };
        ytCancel.onclick = () => ytModal.classList.add('hidden');
        
        ytForm.onsubmit = async (e) => {
            e.preventDefault();
            const topic = document.getElementById('yt-topic').value.trim();
            const link = document.getElementById('yt-link').value.trim();
            
            if (!topic || !link) return;
            
            const ytMessage = `YT_VIDEO|${topic}|${link}`;
            
            // Re-use current logic to send a specialty msg
            const input = document.getElementById('chat-input');
            const oldVal = input.value;
            input.value = ytMessage;
            await submit();
            input.value = oldVal;
            // Reset and close
            ytForm.reset();
            ytModal.classList.add('hidden');
            updateResourcesList();
        };
    }

    // Tabs logic
    const tabActiveBtn = document.getElementById('tab-active-btn');
    const tabSolvedBtn = document.getElementById('tab-solved-btn');
    const tabConnectionsBtn = document.getElementById('tab-connections-btn');
    const tabResourcesBtn = document.getElementById('tab-resources-btn');
    const viewConversations = document.getElementById('chat-conversations-list');
    const viewResources = document.getElementById('resources-list-view');

    if (tabActiveBtn && tabResourcesBtn) {
        tabActiveBtn.onclick = () => {
            if (!activeMentorId) return alert("Select a Connection first to see active doubts for that mentor.");
            tabActiveBtn.className = "text-sm font-bold border-b-2 border-primary pb-2 text-primary";
            tabSolvedBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabConnectionsBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabResourcesBtn.className = "text-sm font-medium text-slate-500 pb-2 flex items-center gap-1";
            viewConversations.classList.remove('hidden');
            viewResources.classList.add('hidden');
            window.renderMentorList('active');
        };

        tabSolvedBtn.onclick = () => {
            if (!activeMentorId) return alert("Select a Connection first to see solved doubts for that mentor.");
            tabSolvedBtn.className = "text-sm font-bold border-b-2 border-primary pb-2 text-primary";
            tabActiveBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabConnectionsBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabResourcesBtn.className = "text-sm font-medium text-slate-500 pb-2 flex items-center gap-1";
            viewConversations.classList.remove('hidden');
            viewResources.classList.add('hidden');
            window.renderMentorList('solved');
        };

        tabConnectionsBtn.onclick = () => {
            tabConnectionsBtn.className = "text-sm font-bold border-b-2 border-primary pb-2 text-primary";
            tabActiveBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabSolvedBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabResourcesBtn.className = "text-sm font-medium text-slate-500 pb-2 flex items-center gap-1";
            viewConversations.classList.remove('hidden');
            viewResources.classList.add('hidden');
            window.renderMentorList('connections');
        };

        tabResourcesBtn.onclick = () => {
            tabResourcesBtn.className = "text-sm font-bold border-b-2 border-primary pb-2 text-primary flex items-center gap-1";
            tabActiveBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabSolvedBtn.className = "text-sm font-medium text-slate-500 pb-2";
            tabConnectionsBtn.className = "text-sm font-medium text-slate-500 pb-2";
            viewResources.classList.remove('hidden');
            viewConversations.classList.add('hidden');
            updateResourcesList();
        };
    }
}

document.addEventListener('DOMContentLoaded', init);
