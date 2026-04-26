import { supabase } from '/assets/js/supabase-client.js';

let currentUser = null;

async function initSettings() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = '/landing.html';
        return;
    }
    currentUser = session.user;

    // Load Profile Data
    const { data: profile } = await supabase.from('users').select('*').eq('id', currentUser.id).single();
    if (profile) {
        const nameInput = document.getElementById('settings-display-name');
        const emailInput = document.getElementById('settings-email');
        const roleBadge = document.getElementById('settings-role-badge');
        const avatar = document.getElementById('settings-avatar');

        if (nameInput) nameInput.value = profile.name || '';
        if (emailInput) emailInput.value = currentUser.email;
        if (roleBadge) {
            roleBadge.textContent = profile.role.toUpperCase();
            // Color code based on role
            if (profile.role === 'faculty') roleBadge.classList.add('bg-blue-100', 'text-blue-700');
            if (profile.role === 'mentor') roleBadge.classList.add('bg-indigo-100', 'text-indigo-700');
            if (profile.role === 'student') roleBadge.classList.add('bg-slate-100', 'text-slate-600');
        }
        if (avatar) avatar.textContent = (profile.name || currentUser.email).charAt(0).toUpperCase();

        document.getElementById('save-name-btn').addEventListener('click', () => saveName(nameInput.value.trim()));

        // Load academic details for non-faculty
        if (profile.role !== 'faculty' && profile.role !== 'admin') {
            const studentSettings = document.getElementById('student-only-settings');
            if (studentSettings) studentSettings.classList.remove('hidden');

            const sectionInput = document.getElementById('settings-section');
            const yearSelect = document.getElementById('settings-year');
            const facultyInput = document.getElementById('settings-faculty-advisor');
            const hostlerSelect = document.getElementById('settings-hostler');

            if (sectionInput) sectionInput.value = profile.section || '';
            if (yearSelect) yearSelect.value = profile.year || '1';
            if (facultyInput) facultyInput.value = profile.faculty_advisor || '';
            if (hostlerSelect) hostlerSelect.value = profile.hostler || 'Day Scholar';

            const saveBtn = document.getElementById('save-academic-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', () => saveAcademicDetails(
                    sectionInput.value.trim(),
                    yearSelect.value,
                    facultyInput.value.trim(),
                    hostlerSelect.value
                ));
            }
        }
    }

    // Theme Switch
    const themeBtn = document.getElementById('theme-switch-btn');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('edubridge_dark_mode', isDark ? 'enabled' : 'disabled');
            
            // Update UI toggle
            const circle = themeBtn.querySelector('div');
            if (isDark) {
                circle.classList.add('translate-x-6');
                themeBtn.classList.replace('bg-slate-200', 'bg-primary/40');
            } else {
                circle.classList.remove('translate-x-6');
                themeBtn.classList.replace('bg-primary/40', 'bg-slate-200');
            }
        });

        // Initialize button state
        const isDark = document.documentElement.classList.contains('dark');
        const circle = themeBtn.querySelector('div');
        if (isDark) {
            circle.classList.add('translate-x-6');
            themeBtn.classList.replace('bg-slate-200', 'bg-primary/40');
        }
    }

    // ── Developer Debug Section ──────────────────────────────────
    const debugResetBtn = document.getElementById('debug-reset-streak');
    if (debugResetBtn) {
        debugResetBtn.addEventListener('click', () => {
            if (confirm('Warning: This will wipe your local active-time cache for today. You will need to re-earn engagement time for your streak. Continue?')) {
                const today = new Date().toISOString().split('T')[0];
                localStorage.removeItem('activeTime_day_' + today);
                localStorage.removeItem('activeTime_total');
                localStorage.removeItem('edubridge_stats');
                
                alert('Local Engagement Cache Wiped! The page will now reload.');
                window.location.reload();
            }
        });
    }
}

async function saveName(newName) {
    if (!newName) return;
    const btn = document.getElementById('save-name-btn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const { error } = await supabase
            .from('users')
            .update({ name: newName })
            .eq('id', currentUser.id);

        if (error) throw error;
        
        // Update avatar
        document.getElementById('settings-avatar').textContent = newName.charAt(0).toUpperCase();
        
        // Success feedback
        btn.textContent = 'Saved!';
        btn.classList.replace('bg-primary', 'bg-green-600');
        setTimeout(() => {
            btn.textContent = 'Save';
            btn.classList.replace('bg-green-600', 'bg-primary');
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        alert("Failed to update name: " + err.message);
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

async function saveAcademicDetails(section, year, faculty_advisor, hostler) {
    const btn = document.getElementById('save-academic-btn');
    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
        const { error } = await supabase
            .from('users')
            .update({ 
                section,
                year,
                faculty_advisor,
                hostler
            })
            .eq('id', currentUser.id);

        if (error) throw error;
        
        btn.textContent = 'Updated!';
        const ogClasses = btn.className;
        btn.className = 'px-6 py-2.5 rounded-xl font-black text-sm bg-green-600 text-white transition-all';
        setTimeout(() => {
            btn.className = ogClasses;
            btn.textContent = 'Update Details';
            btn.disabled = false;
        }, 2000);

    } catch (err) {
        alert("Failed to update details: " + err.message);
        btn.disabled = false;
        btn.textContent = 'Update Details';
    }
}

document.addEventListener('DOMContentLoaded', initSettings);
