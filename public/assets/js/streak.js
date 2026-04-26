
/*
-- RUN THIS IN YOUR SUPABASE SQL EDITOR --

-- Create table for daily activity tracking
CREATE TABLE IF NOT EXISTS user_daily_activity (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_date DATE DEFAULT CURRENT_DATE,
    minutes_spent INT DEFAULT 0,
    is_streak_counted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, activity_date)
);

-- Create table for long-term streak storage
CREATE TABLE IF NOT EXISTS user_streaks (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    current_streak INT DEFAULT 0,
    last_active_date DATE,
    weekly_progress JSONB DEFAULT '{"Sun": false, "Mon": false, "Tue": false, "Wed": false, "Thu": false, "Fri": false, "Sat": false}'::JSONB
);

-- Enable RLS
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own activity" ON user_daily_activity
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own streaks" ON user_streaks
    FOR ALL USING (auth.uid() = user_id);
*/

import { supabase } from '/assets/js/supabase-client.js';

class StreakSystem {
    constructor() {
        this.userId = null;
        this.minutesSpentToday = 0;
        this.STREAK_THRESHOLD = 10; // 10 minutes
        this.initInterval = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        
        // 1. Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        this.userId = session.user.id;
        this.currentDate = new Date().toISOString().split('T')[0];

        // 2. Load today's progress
        await this.loadTodayProgress();

        // 3. Inject UI
        this.injectStreakWidget();

        // 4. Start Tracking
        this.startTracking();
        
        this.isInitialized = true;
        console.log("🔥 Streak System Initialized");
    }

    loadTodayProgress() {
        const today = new Date().toISOString().split('T')[0];
        // Read from institutional analytics logic (localStorage)
        const localActiveMs = parseInt(localStorage.getItem('activeTime_day_' + today) || '0', 10);
        this.minutesSpentToday = Math.floor(localActiveMs / 60000);
        
        // Final check against DB to ensure cross-device continuity
        this.syncWithSupabase(today);
    }

    async syncWithSupabase(today) {
        const { data, error } = await supabase
            .from('user_daily_activity')
            .select('minutes_spent, is_streak_counted')
            .eq('user_id', this.userId)
            .eq('activity_date', today)
            .single();

        if (data) {
            // Keep the maximum of local active time or DB time
            this.minutesSpentToday = Math.max(this.minutesSpentToday, data.minutes_spent);
        } else {
            // Initialize today's record in DB
            await supabase.from('user_daily_activity').insert({
                user_id: this.userId,
                activity_date: today,
                minutes_spent: this.minutesSpentToday
            });
        }
    }

    startTracking() {
        // Sync with local active time tracker every 30 seconds
        this.initInterval = setInterval(async () => {
            const today = new Date().toISOString().split('T')[0];

            if (today !== this.currentDate) {
                console.log("📅 Midnight detected in tracker. Resetting.");
                this.currentDate = today;
                this.loadTodayProgress();
                this.updateWidgetUI();
                return;
            }

            // 🖱️ ACTIVE ENGAGEMENT LOGIC: Read from window-wide analytics listeners
            const localActiveMs = parseInt(localStorage.getItem('activeTime_day_' + today) || '0', 10);
            const activeMinutes = Math.floor(localActiveMs / 60000);

            if (activeMinutes > this.minutesSpentToday) {
                this.minutesSpentToday = activeMinutes;

                // Update Supabase with the newly earned active minute
                const { data } = await supabase
                    .from('user_daily_activity')
                    .update({ minutes_spent: this.minutesSpentToday })
                    .eq('user_id', this.userId)
                    .eq('activity_date', today)
                    .select()
                    .single();

                if (data && data.minutes_spent >= this.STREAK_THRESHOLD && !data.is_streak_counted) {
                    await this.completeDay(today);
                }
            }

            this.updateWidgetUI();
        }, 30000); // Poll every 30 seconds for smoother progression
    }

    async completeDay(dateStr) {
        // 1. Mark activity as counted
        await supabase
            .from('user_daily_activity')
            .update({ is_streak_counted: true })
            .eq('user_id', this.userId)
            .eq('activity_date', dateStr);

        // 2. Update overall streak
        const { data: streakData } = await supabase
            .from('user_streaks')
            .select('*')
            .eq('user_id', this.userId)
            .single();

        let newStreak = 1;
        if (streakData) {
            const lastDate = new Date(streakData.last_active_date);
            const today = new Date(dateStr);
            
            // Set to midnight for accurate day comparison
            lastDate.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            
            const diffTime = today.getTime() - lastDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak = streakData.current_streak + 1;
            } else if (diffDays === 0) {
                newStreak = streakData.current_streak; // Already counted
            } else {
                // Was broken, so now starts at 1 newly
                newStreak = 1;
            }
        }

        // Save to DB
        const { error } = await supabase
            .from('user_streaks')
            .upsert({
                user_id: this.userId,
                current_streak: newStreak,
                last_active_date: dateStr
            });

        if (!error) {
            this.showCelebration(newStreak);
        }
    }

    injectStreakWidget() {
        const headerRight = document.querySelector('header .flex.items-center:last-child');
        if (!headerRight) return;

        const widget = document.createElement('div');
        widget.id = 'streak-widget';
        widget.className = 'flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800 rounded-full cursor-pointer hover:scale-105 transition-all active:scale-95 group relative';
        widget.innerHTML = `
            <span class="material-symbols-outlined text-orange-500 text-[20px] fill-current animate-pulse group-hover:animate-bounce">local_fire_department</span>
            <span id="streak-count" class="text-sm font-black text-orange-600 dark:text-orange-400">0</span>
        `;

        widget.onclick = () => this.toggleStreakCard();
        
        // Insert before profile/notifications
        headerRight.insertBefore(widget, headerRight.firstChild);
        
        this.updateWidgetUI();
    }

    async updateWidgetUI() {
        const { data: streakData } = await supabase
            .from('user_streaks')
            .select('current_streak, last_active_date')
            .eq('user_id', this.userId)
            .single();

        let displayStreak = 0;
        if (streakData) {
            const now = new Date();
            const lastActive = new Date(streakData.last_active_date);
            
            now.setHours(0,0,0,0);
            lastActive.setHours(0,0,0,0);
            
            const diffTime = now.getTime() - lastActive.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                // If it was active today or yesterday, streak is alive
                displayStreak = streakData.current_streak;
            } else {
                // ⚠️ STREAK BROKEN: Explicitly reset to 0 in DB and UI
                displayStreak = 0;
                await supabase
                    .from('user_streaks')
                    .update({ current_streak: 0 })
                    .eq('user_id', this.userId);
            }
        }

        const countEl = document.getElementById('streak-count');
        if (countEl) {
            countEl.innerText = displayStreak;
        }

        // Update card if open
        const cardStreakVal = document.querySelector('#streak-info-card p.text-5xl');
        if (cardStreakVal) cardStreakVal.innerText = displayStreak;
    }

    async toggleStreakCard() {
        let card = document.getElementById('streak-info-card');
        if (card) {
            card.remove();
            return;
        }

        const { data: streakData } = await supabase
            .from('user_streaks')
            .select('*')
            .eq('user_id', this.userId)
            .single();

        // 📅 DYNAMIC WEEKLY PROGRESS: Fetch actual activity logs for the current week (Sun-Sat)
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
        startOfWeek.setHours(0,0,0,0);
        const startStr = startOfWeek.toISOString().split('T')[0];

        const { data: weekActivity } = await supabase
            .from('user_daily_activity')
            .select('activity_date, is_streak_counted')
            .eq('user_id', this.userId)
            .gte('activity_date', startStr)
            .order('activity_date', { ascending: true });

        const progressMap = {};
        weekActivity?.forEach(log => {
            // Use UTC/ISO parsing to avoid timezone shifts
            const date = new Date(log.activity_date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
            progressMap[dayName] = log.is_streak_counted;
        });

        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        card = document.createElement('div');
        card.id = 'streak-info-card';
        card.className = 'fixed top-20 right-6 w-80 bg-white dark:bg-slate-900 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-2xl z-[110] p-6 fade-in scale-in';
        
        card.innerHTML = `
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-xl font-black text-slate-900 dark:text-white">Daily Streak</h4>
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Institutional Consistency</p>
                    </div>
                    <div class="size-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                        <span class="material-symbols-outlined text-2xl fill-current">local_fire_department</span>
                    </div>
                </div>

                <div class="bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl p-6 text-white text-center">
                    <p class="text-5xl font-black">${streakData?.current_streak || 0}</p>
                    <p class="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mt-2">Days Completed</p>
                </div>

                <!-- Live Daily Progress Tracker -->
                <div class="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div class="flex items-center justify-between mb-3">
                        <p class="text-xs font-black text-slate-700 dark:text-slate-200">Time Spent</p>
                        <p class="text-[11px] font-black text-slate-900 dark:text-white tabular-nums">
                            ${Math.min(this.minutesSpentToday, this.STREAK_THRESHOLD)}/${this.STREAK_THRESHOLD} <span class="text-slate-400 font-bold ml-0.5">mins</span>
                        </p>
                    </div>
                    <div class="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-orange-500 transition-all duration-1000 ease-out shadow-[0_0_12px_rgba(249,115,22,0.4)]" 
                             style="width: ${Math.min(100, (this.minutesSpentToday / this.STREAK_THRESHOLD) * 100)}%"></div>
                    </div>
                </div>

                <div class="space-y-4">
                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Weekly Progress</p>
                    <div class="flex justify-between items-center px-1">
                        ${days.map(d => `
                            <div class="flex flex-col items-center gap-2">
                                <div class="size-8 rounded-full flex items-center justify-center transition-all ${progressMap[d] ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}">
                                    <span class="material-symbols-outlined text-xs font-black">${progressMap[d] ? 'check' : ''}</span>
                                </div>
                                <span class="text-[9px] font-black uppercase tracking-widest ${progressMap[d] ? 'text-orange-500' : 'text-slate-400'}">${d}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                    <p class="text-[10px] text-slate-500 font-medium">Goal: Spend 10 mins daily (00:01 - 23:59) to grow your streak.</p>
                </div>
            </div>
        `;

        document.body.appendChild(card);

        // Click outside to close
        const closeHandler = (e) => {
            if (!card.contains(e.target) && !document.getElementById('streak-widget').contains(e.target)) {
                card.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }

    showCelebration(streak) {
        // Simple notification
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white rounded-2xl px-6 py-4 shadow-2xl z-[200] flex items-center gap-4 border border-white/10 animate-bounce';
        toast.innerHTML = `
            <div class="size-10 bg-orange-500 rounded-xl flex items-center justify-center text-white shadow-lg">
                <span class="material-symbols-outlined fill-current">local_fire_department</span>
            </div>
            <div>
                <p class="font-black text-sm uppercase tracking-tight">STREAK EXTENDED!</p>
                <p class="text-xs text-slate-400 font-medium">You've reached a ${streak}-day streak. Keep it going!</p>
            </div>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }
}

export const streakSystem = new StreakSystem();
