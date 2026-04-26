import { supabase } from '/assets/js/supabase-client.js';
import * as auth from '/assets/js/auth.js';

async function initAdminControl() {
  const user = await auth.getCurrentUser();
  if (!user || !auth.isAdmin(user.email)) {
    console.warn('Unauthorized access to Admin dashboard.');
    window.location.href = '/landing.html';
    return;
  }

  const el = document.getElementById('admin-email-display');
  const av = document.getElementById('admin-avatar');
  if (el) el.innerText = user.email;
  if (av) av.innerHTML = `<img src="${window.getAvatarUrl(user.email, 40)}" class="size-full object-cover">`;

  setupTabs();
  
  // Initial fetch
  await fetchAndDisplayUsers();
  loadAdminAnnouncements();

  // Auto-refresh loop (every 10 seconds for real-time presence sync)
  setInterval(() => {
      fetchAndDisplayUsers(true); // silent refresh
  }, 10000);
}

async function loadAdminAnnouncements() {
    const list = document.getElementById('admin-announcements-list');
    const container = document.getElementById('admin-announcements');
    if (!list || !container) return;

    try {
        const { data: anns, error } = await supabase
            .from('announcements')
            .select('*, author:users(name, email, role)')
            .order('created_at', { ascending: false })
            .limit(6);

        if (error) throw error;
        
        if (!anns || anns.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        list.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[160px] overflow-y-auto pr-2 no-scrollbar scroll-smooth";
        list.innerHTML = anns.map(a => `
            <div class="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 shadow-sm relative group overflow-hidden border-l-4 border-l-blue-500">
                <div class="flex items-center gap-2 mb-2">
                    <img src="${window.getAvatarUrl(a.author?.email, 24)}" class="size-5 rounded-full object-cover">
                    <span class="text-[8px] font-black uppercase text-slate-400 tracking-widest">${a.author?.name || 'System'}</span>
                    <button onclick="window.readFullAnnouncement('${a.id}', \`${a.title.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`, \`${a.body.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\` )" class="text-[8px] font-black uppercase text-blue-500 hover:underline ml-auto">Read Full</button>
                </div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white mb-1 truncate">${a.title}</h4>
                <p class="text-[10px] text-slate-500 line-clamp-1">${a.body}</p>
            </div>
        `).join('');
    } catch(err) {
        console.error("Admin announcements failed:", err);
    }
}

window.loadAnnouncements = loadAdminAnnouncements; // Expose for layout.js refresh

function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.nav-tab').forEach(b => {
        const m = b.getAttribute('data-tab') === tabName;
        b.classList.toggle('bg-blue-50', m);
        b.classList.toggle('text-blue-700', m);
        b.classList.toggle('dark:bg-blue-900/20', m);
        b.classList.toggle('dark:text-blue-400', m);
    });
    
    const target = document.getElementById('tab-' + tabName);
    if (target) target.classList.remove('hidden');
    
    if (tabName === 'mentorship') loadMentorshipOversight();
    if (tabName === 'directory') fetchAndDisplayUsers();
    if (tabName === 'consistency') loadConsistencyLeaderboard();
    if (tabName === 'tracking-sheets') {
        import('./tracking-sheets.js').then(module => {
            module.initTrackingSheets('tracking-pairs-list');
        });
    }
}

// ── CONSISTENCY LEADERBOARD LOGIC ──────────────────────────────────────────
async function loadConsistencyLeaderboard() {
    const tableBody = document.getElementById('consistency-table-body');
    if (!tableBody) return;

    try {
        const { data, error } = await supabase
            .from('user_streaks')
            .select('*')
            .order('current_streak', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-slate-400 italic">No streak data captured in system yet.</td></tr>`;
            return;
        }

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        tableBody.innerHTML = data.map((u, index) => {
            const progress = u.weekly_progress || {};
            const isTop3 = index < 3;
            const streakColor = isTop3 ? 'text-orange-500' : 'text-slate-900 dark:text-white';
            
            return `
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-4">
                            <div class="relative">
                                <img src="${window.getAvatarUrl(u.email, 40)}" class="size-10 rounded-full object-cover border-2 border-slate-100 dark:border-slate-800 ${isTop3 ? 'border-orange-500/50' : ''}">
                                ${isTop3 ? `<div class="absolute -top-1 -right-1 size-5 bg-orange-500 text-white rounded-full flex items-center justify-center text-[10px] font-black">#${index+1}</div>` : ''}
                            </div>
                            <div>
                                <p class="font-black text-slate-900 dark:text-white">${u.name || 'Anonymous User'}</p>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${u.email}</p>
                                ${u.register_number ? `<p class="text-[9px] font-black text-blue-500 uppercase tracking-widest mt-0.5">REG: ${u.register_number}</p>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            ${u.role}
                        </div>
                    </td>
                    <td class="px-8 py-6 text-center">
                        <div class="flex flex-col items-center">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[20px] ${u.current_streak > 0 ? 'text-orange-500 animate-pulse fill-current' : 'text-slate-300'}">local_fire_department</span>
                                <span class="text-2xl font-black ${streakColor} tabular-nums">${u.current_streak}</span>
                            </div>
                            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Days Streak</p>
                        </div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="flex gap-1.5">
                            ${days.map(d => {
                                const active = progress[d];
                                return `<div class="size-6 rounded-md flex items-center justify-center text-[8px] font-black transition-all ${active ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-300'}" title="${d}">${active ? '✓' : d[0]}</div>`;
                            }).join('')}
                        </div>
                    </td>
                    <td class="px-8 py-6 text-right">
                        <p class="text-xs font-bold text-slate-900 dark:text-white">${u.last_active_date ? new Date(u.last_active_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}</p>
                        <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional Presence</p>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load leaderboard:", err);
    }
}

// ── MENTORSHIP OVERSIGHT LOGIC ──────────────────────────────────────────────
let oversightBroadcastSub = null;
let oversightDbSub = null;
let activeOversightMentorId = null;
const oversightUsersCache = {};

// Robust flagged words list
// Robust flagged words list for ecosystem maintenance
const FLAG_WORDS = ['abuse','stupid','idiot','fool','hate','kill','damn','crap','shut up','dumb','loser','hell','suck','weirdo','jerk','ass','bastard','wtf','nonsense','garbage','trash','fail','pathetic','nigger','faggot','cunt','bitch','whore','slut','dick','pussy','cock','fuck','shit'];

function flagCheck(text) {
    const lower = text.toLowerCase();
    return FLAG_WORDS.some(w => lower.includes(w));
}

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function loadMentorshipOversight() {
    const list = document.getElementById('oversight-mentor-list');
    if (!list) return;
    list.innerHTML = `<div class="p-8 text-center text-slate-400 italic text-sm">Scanning ecosystem for active mentors...</div>`;

    try {
        const { data: mentors, error } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('role', 'mentor');

        if (error) throw error;

        if (!mentors || mentors.length === 0) {
            list.innerHTML = `<div class="p-8 text-center text-slate-400">No mentors found in directory.</div>`;
            return;
        }

        list.innerHTML = mentors.map(m => {
            const avatar = window.getAvatarUrl(m.email, 48);
            return `
                <div onclick="viewOversightChat('${m.id}', '${esc(m.name || m.email.split('@')[0])}')" 
                    class="group p-6 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer border-l-4 border-transparent hover:border-primary">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <img src="${avatar}" class="size-12 rounded-full object-cover border-2 border-slate-100 group-hover:border-primary transition-all">
                            <div>
                                <p class="font-black text-sm text-slate-900 dark:text-white group-hover:text-primary transition-colors">${m.name || m.email.split('@')[0]}</p>
                                <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Cohort Leader</p>
                            </div>
                        </div>
                        <span class="material-symbols-outlined text-slate-200 group-hover:text-primary transition-all">monitoring</span>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load mentors:", err);
    }
}

window.viewOversightChat = async function(mentorId, mentorName) {
    activeOversightMentorId = mentorId;

    const title = document.getElementById('oversight-chat-title');
    if (title) title.innerHTML = `<span class="material-symbols-outlined text-[20px] text-primary">visibility</span> Monitoring: ${esc(mentorName)}'s Hub <span class="ml-2 text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">● LIVE FEED</span>`;

    const box = document.getElementById('oversight-chat-log');
    if (!box) return;
    box.innerHTML = `<div class="h-full flex flex-col items-center justify-center text-slate-400 gap-4">
        <div class="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p class="text-sm font-bold animate-pulse">Establishing secure uplink...</p>
    </div>`;

    // Tear down previous subscriptions
    if (oversightBroadcastSub) { supabase.removeChannel(oversightBroadcastSub); oversightBroadcastSub = null; }
    if (oversightDbSub) { supabase.removeChannel(oversightDbSub); oversightDbSub = null; }

    // Subscribe to Broadcast channel (instant delivery)
    oversightBroadcastSub = supabase.channel(`chat_broadcast:${mentorId}`, {
        config: { broadcast: { self: false } }
    });
    oversightBroadcastSub
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
            appendOversightMessage(payload);
        })
        .subscribe();

    // Subscribe to DB changes (fallback/history)
    oversightDbSub = supabase.channel(`oversight_db_admin:${mentorId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cohort_chats',
            filter: `mentor_id=eq.${mentorId}`
        }, ({ new: msg }) => {
            if (box.querySelector(`[data-id="${msg.id}"]`)) return;
            appendOversightMessage(msg);
        })
        .subscribe();

    // Fetch history
    const { data: messages } = await supabase
        .from('cohort_chats')
        .select('*')
        .eq('mentor_id', mentorId)
        .order('created_at', { ascending: true })
        .limit(300);

    const msgs = messages || [];
    const senderIds = [...new Set(msgs.map(m => m.sender_id))];
    if (senderIds.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', senderIds);
        if (usersData) usersData.forEach(u => oversightUsersCache[u.id] = { name: u.name, email: u.email });
    }

    box.innerHTML = '';
    
    if (!msgs.length) {
        box.innerHTML = `<div class="h-full flex items-center justify-center text-slate-400 flex-col gap-4">
            <span class="material-symbols-outlined text-4xl">chat_bubble_outline</span>
            <p class="font-bold">This hub is currently silent.</p>
        </div>`;
        return;
    }

    const flaggedCount = msgs.filter(m => flagCheck(m.message)).length;
    if (flaggedCount > 0) {
        box.insertAdjacentHTML('beforeend', `
            <div class="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-4">
                <div class="size-10 bg-red-500 text-white rounded-full flex items-center justify-center animate-bounce">
                    <span class="material-symbols-outlined">warning</span>
                </div>
                <div>
                    <p class="text-sm font-black text-red-700 dark:text-red-400">CRITICAL: ${flaggedCount} Unparliamentary Event${flaggedCount > 1 ? 's' : ''} Detected</p>
                    <p class="text-xs text-red-600 dark:text-red-500 font-medium">Review the highlighted messages below for ecosystem integrity.</p>
                </div>
            </div>
        `);
    }

    msgs.forEach(m => box.insertAdjacentHTML('beforeend', oversightBubble(m)));
    box.scrollTop = box.scrollHeight;
};

function oversightBubble(m) {
    let rawMsg = m.message || '';
    let targetMenteeId = null;
    let conversationCtx = '';

    // DM context resolution
    if (rawMsg.startsWith('DM|')) {
        const parts = rawMsg.split('|');
        targetMenteeId = parts[1];
        rawMsg = parts.slice(2).join('|');
    }

    // Determine target mentee name
    if (targetMenteeId) {
        const menteeName = typeof oversightUsersCache[targetMenteeId] === 'object' ? oversightUsersCache[targetMenteeId].name : (oversightUsersCache[targetMenteeId] || 'Student');
        conversationCtx = `<span class="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full ml-auto">To: ${esc(menteeName)}</span>`;
    }

    const isMentor = m.sender_id === m.mentor_id;
    const cacheData = oversightUsersCache[m.sender_id];
    let userData = { name: (isMentor ? 'Mentor' : 'Student'), email: '' };
    
    if (cacheData) {
        if (typeof cacheData === 'string') userData.name = cacheData;
        else userData = cacheData;
    }

    const name = userData.name;
    const isVote = rawMsg.startsWith('SYSTEM_VOTE|');
    const isFlag = flagCheck(rawMsg);
    const ts = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live';
    const avatar = window.getAvatarUrl(userData.email || '', 32);

    const bg = isMentor 
        ? 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800' 
        : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800';
    
    if (isVote) {
        const pts = rawMsg.split('|');
        const topic = esc(pts[1]);
        const opt = esc(pts[2]);
        const action = esc(pts[3] || 'voted for');
        return `
            <div class="flex justify-center w-full my-4" data-id="${m.id || ''}">
                <span class="text-[9px] uppercase tracking-widest font-black text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full border border-slate-100 dark:border-slate-800 text-center max-w-[90%]">
                    ${esc(name)} ${action} "${opt}" in ${topic}
                </span>
            </div>
        `;
    } else if (rawMsg && (rawMsg.includes('SYSTEM_DOUBT_START|') || rawMsg.includes('SYSTEM_DOUBT_END|'))) {
        const parts = rawMsg.split('|');
        const isStart = rawMsg.includes('SYSTEM_DOUBT_START');
        const topic = esc(parts[1] || 'Academic Discussion');
        const sessId = parts[2] ? parts[2].substring(0, 8) : '...';
        
        const cardColor = isStart ? 'border-primary' : 'border-emerald-500';
        const icon = isStart ? 'rocket_launch' : 'task_alt';
        const label = isStart ? 'Discussion Initiated' : 'Doubt Cleared';
        const subtext = isStart ? 'Tracking Sheet Filed' : 'Academic Log Finalized';
        const authorLine = esc(name);

        return `<div class="flex justify-center w-full my-4 msg-bubble-ov" data-id="${m.id || ''}">
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
                        <img src="${avatar}" class="size-4 rounded-full">
                        <span class="text-[9px] font-bold text-slate-500">${authorLine} ${isMentor ? '(Mentor)' : '(Mentee)'}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    const badge = isMentor ? `<span class="bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-widest font-black">Mentor</span>` : `<span class="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 text-[8px] px-1.5 py-0.5 rounded ml-1 uppercase tracking-widest font-black">Mentee</span>`;
    const flagBadge = isFlag ? `<span class="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full ml-2 uppercase tracking-widest font-black animate-pulse">⚠ Flagged</span>` : '';

    return `
        <div class="flex flex-col items-start w-full mb-6 ${isFlag ? 'animate-pulse' : ''} msg-bubble-ov" data-id="${m.id || ''}">
            <div class="flex items-center gap-2 mb-2 ml-1 w-full">
                <img src="${avatar}" class="size-5 rounded-full object-cover">
                <span class="text-[10px] font-black uppercase tracking-widest ${isMentor ? 'text-indigo-600' : 'text-slate-500'}">${esc(name)}</span>
                ${badge}${flagBadge}
                ${conversationCtx}
                <span class="text-[9px] text-slate-300 font-bold ml-2">${ts}</span>
            </div>
            <div class="px-5 py-3 rounded-[20px] border ${bg} shadow-sm text-sm max-w-[85%] ${isFlag ? 'text-red-700 dark:text-red-400 font-bold border-red-200 bg-red-50/50' : 'text-slate-700 dark:text-slate-200'}">
                ${(() => {
                    let content = esc(rawMsg);
                    if (rawMsg && rawMsg.startsWith('YT_VIDEO|')) {
                        const parts = rawMsg.split('|');
                        const topic = esc(parts[1] || 'Video Resource');
                        const url = parts[2] || '';
                        const vidId = url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop();
                        
                        return `
                            <div class="text-[10px] font-black uppercase text-indigo-500 mb-1">Shared Resource</div>
                            <div class="font-bold mb-2">${topic}</div>
                            <div class="rounded-xl overflow-hidden aspect-video bg-black my-2">
                                    <iframe class="w-full h-full" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe>
                            </div>
                            <a href="${url}" target="_blank" class="text-[10px] text-blue-500 underline uppercase font-bold tracking-widest flex items-center gap-1">
                                <span class="material-symbols-outlined text-[12px]">open_in_new</span> Open on YouTube
                            </a>
                        `;
                    } else if (rawMsg && rawMsg.startsWith('POLL|')) {
                        const parts = rawMsg.split('|');
                        const topic = esc(parts[1] || 'Poll');
                        const options = parts[2] ? parts[2].split(',') : [];
                        return `
                            <div class="text-[10px] font-black uppercase text-indigo-500 mb-1">Live Poll Created</div>
                            <div class="font-bold mb-3">${topic}</div>
                            <div class="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                                ${options.map(o => `
                                    <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-[11px] font-medium">
                                        <div class="size-3 rounded-full border border-slate-300"></div>
                                        ${esc(o)}
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                    return content;
                })()}
            </div>
        </div>
    `;
}

async function appendOversightMessage(payload) {
    const box = document.getElementById('oversight-chat-log');
    if (!box || activeOversightMentorId !== payload.mentor_id) return;

    if (!oversightUsersCache[payload.sender_id]) {
        if (payload.sender_name && payload.sender_email) {
            oversightUsersCache[payload.sender_id] = { name: payload.sender_name, email: payload.sender_email };
        } else {
            const { data: u } = await supabase.from('users').select('name, email').eq('id', payload.sender_id).single();
            oversightUsersCache[payload.sender_id] = { name: u?.name || 'Student', email: u?.email || '' };
        }
    }

    box.insertAdjacentHTML('beforeend', oversightBubble(payload));
    box.scrollTop = box.scrollHeight;
}

// ── DIRECTORY LOGIC ────────────────────────────────────────────────────────
async function fetchAndDisplayUsers(silent = false) {
  const loader = document.getElementById('loading-state');
  const tableBody = document.getElementById('user-table-body');
  if (!tableBody) return;
  
  if (!silent && loader) loader.classList.remove('hidden');

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    if (loader) loader.classList.add('hidden');
    return;
  }

  if (loader) loader.classList.add('hidden');
  tableBody.innerHTML = '';
  
  // Get Presence state from layout.js
  const onlineUserIds = Object.keys(window.onlineUsers || {});

  data.forEach(user => {
    const isOnline = onlineUserIds.includes(user.id);
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 transition-colors';
    
    const statusHTML = `
        <div class="flex items-center gap-1.5">
            <span class="relative flex h-2 w-2">
                <span class="${isOnline ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full ${isOnline ? 'bg-emerald-400 opacity-75' : 'bg-slate-200'}"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}"></span>
            </span>
            <span class="text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-slate-400'}">${isOnline ? 'Online' : 'Offline'}</span>
        </div>`;

    row.innerHTML = `
      <td class="px-8 py-6">
        <div class="flex items-center gap-4">
          <img src="${window.getAvatarUrl(user.email, 40)}" class="size-10 rounded-full object-cover border-2 border-slate-100 shadow-sm">
          <div>
            <p class="font-bold text-slate-800 dark:text-slate-100">${user.name || 'Incognito User'}</p>
            <p class="text-xs text-slate-400 font-medium">${user.email}</p>
          </div>
        </div>
      </td>
      <td class="px-8 py-6">${statusHTML}</td>
      <td class="px-8 py-6 font-bold text-xs">
        <select class="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-primary outline-none transition-all" id="role-${user.id}">
          <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
          <option value="mentor" ${user.role === 'mentor' ? 'selected' : ''}>Mentor</option>
          <option value="faculty" ${user.role === 'faculty' ? 'selected' : ''}>Faculty</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td class="px-8 py-6 text-xs text-slate-400 font-bold tabular-nums">
        ${new Date(user.created_at).toLocaleDateString('en-GB')}
      </td>
      <td class="px-8 py-6">
        <button class="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all update-role-btn" data-id="${user.id}">
          Update Role
        </button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll('.update-role-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.getAttribute('data-id');
      const newRole = document.getElementById(`role-${userId}`).value;
      
      e.target.innerText = 'Updating...';
      e.target.disabled = true;

      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        alert('Failed to update role. Please check policies.');
        console.error(error);
        e.target.innerText = 'Update Role';
        e.target.disabled = false;
      } else {
        e.target.innerText = 'Updated ✅';
        e.target.classList.replace('bg-blue-600', 'bg-emerald-500');
        setTimeout(() => {
          e.target.innerText = 'Update Role';
          e.target.classList.replace('bg-emerald-500', 'bg-blue-600');
          e.target.disabled = false;
        }, 2000);
      }
    });
  });
}

// Use a separate ID for the table-based bulk sync button in Cloud Archives tab
const adminSyncBtn = document.getElementById('admin-bulk-sync-btn');
const globalSyncBtn = document.getElementById('bulk-sync-btn'); // Top bar button if any

[adminSyncBtn, globalSyncBtn].forEach(syncBtn => {
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const originalContent = syncBtn.innerHTML;
            try {
                syncBtn.disabled = true;
                syncBtn.classList.add('opacity-50', 'bg-slate-500');
                
                const { data: users, error } = await supabase.from('users').select('*');
                if (error) throw error;
                
                let count = 0;
                const total = users.length;
                
                for (const user of users) {
                    count++;
                    syncBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">sync</span><span>Sync ${count}/${total}...</span>`;
                    try {
                        await syncUserToSheets(user);
                    } catch(e) {}
                }
                
                syncBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">check_circle</span><span>Sync Done!</span>`;
                syncBtn.classList.replace('bg-slate-500', 'bg-emerald-500');
                
                setTimeout(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalContent;
                    syncBtn.classList.remove('opacity-50', 'bg-slate-500', 'bg-emerald-500');
                }, 3000);
                
            } catch (err) {
                console.error('Bulk sync failed:', err);
                syncBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">error</span><span>Failed</span>`;
                syncBtn.classList.add('bg-red-500');
                setTimeout(() => {
                    syncBtn.disabled = false;
                    syncBtn.innerHTML = originalContent;
                    syncBtn.classList.remove('bg-red-500', 'opacity-50');
                }, 3000);
            }
        });
    }
});

async function syncUserToSheets(user) {
    const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxHY3aG56hYu81KMZASXtxp3Rl15xUNcNLLeLAQ1U0vWUqxHRJoQzvmrXDzqa7ZdiM0Yw/exec';
    const { data: analytics } = await supabase.from('user_analytics').select('*').eq('user_id', user.id).single();
    const stats = analytics || {};
    
    const payload = {
        email: user.email,
        name: user.name || 'Anonymous',
        registerNumber: user.register_number || '—',
        role: user.role,
        date: new Date(user.created_at).toLocaleString(),
        timeSpent: stats.time_spent || 0,
        notesRead: stats.notes_viewed || 0,
        assignments: stats.assignments_submitted || 0,
        quizzes: stats.quizzes_started || 0,
        notesAdded: user.role === 'faculty' ? "Yes" : "No",
        subjectsAdded: "—"
    };

    await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

// ── CHAT TO GOOGLE SHEET SYNC (Fail-safe Form Method) ─────────────────────
window.syncChatsToGoogleSheet = async function() {
    const btn = document.getElementById('sync-chats-btn');
    if (!btn) return;
    const originalHTML = btn.innerHTML;
    
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl">sync</span> Extracting Logs...`;

        // 1. Fetch
        const { data: chats, error: chatError } = await supabase.from('cohort_chats').select('*').order('created_at', { ascending: true });
        const { data: users, error: userError } = await supabase.from('users').select('id, name, role');
        if (chatError || userError) throw new Error("Supabase connection failed.");

        const usersMap = {};
        users.forEach(u => usersMap[u.id] = u);

        // 2. Filter & Map (Incremental Delta Logic)
        const lastSyncId = localStorage.getItem('last_synced_chat_id');
        const newChats = lastSyncId 
            ? chats.filter(c => c.id > parseInt(lastSyncId)) 
            : chats;

        if (newChats.length === 0) {
            alert("Administrative logs are already up to date in the Cloud Archive.");
            btn.innerHTML = originalHTML; btn.disabled = false;
            return;
        }

        const payload = newChats.map(c => {
            const sender = usersMap[c.sender_id] || { name: 'Unknown', role: 'user' };
            const mentor = usersMap[c.mentor_id] || { name: 'System Cohort', role: 'mentor' };
            return {
                from_name: sender.name,
                from_role: sender.role,
                date: new Date(c.created_at).toLocaleString(),
                to_name: mentor.name,
                to_role: 'mentor',
                message: c.message
            };
        });

        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-xl">sync</span> Bypassing security...`;

        // 3. Invisible Form Submission (Bypasses CORS entirely)
        const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxm5-urPRsVdxMTf6qUxyh5zM3FWsQ4s_CvSyZzm6mkhl_BmukmqwVL5BZxrNJ0lATK/exec';
        
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.name = 'sync_iframe';
        document.body.appendChild(iframe);

        const form = document.createElement('form');
        form.target = 'sync_iframe';
        form.action = GOOGLE_SCRIPT_URL;
        form.method = 'POST';

        const actionInput = document.createElement('input');
        actionInput.name = 'action';
        actionInput.value = 'sync_chats';
        form.appendChild(actionInput);

        const dataInput = document.createElement('input');
        dataInput.name = 'data';
        dataInput.value = JSON.stringify(payload);
        form.appendChild(dataInput);

        document.body.appendChild(form);
        form.submit();

        // Cleanup & Delta Storage
        setTimeout(() => {
            const maxId = Math.max(...newChats.map(c => c.id));
            localStorage.setItem('last_synced_chat_id', maxId);

            document.body.removeChild(form);
            document.body.removeChild(iframe);
            btn.innerHTML = `<span class="material-symbols-outlined text-xl">done_all</span> ${newChats.length} Logs Synced!`;
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 3000);
        }, 2000);

    } catch (err) {
        console.error("Critical Sync Breakdown:", err);
        alert("Sync System Error: " + err.message);
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
};

initAdminControl();

