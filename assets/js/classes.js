async function loadAllClasses() {
    const grid = document.getElementById('all-live-classes-grid');
    if (!grid) return;

    try {
        const { data: classesData, error: classesError } = await window.supabase
            .from('online_classes')
            .select('*')
            .order('class_date', { ascending: false })
            .order('class_time', { ascending: false });

        if (classesError) throw classesError;
        
        // Filter for students only using description metadata
        const filteredClasses = classesData.filter(c => {
            if (!c.description) return true; // Legacy if no metadata
            const t = c.description.match(/\[T:(.*?)\]/);
            return !t || t[1] === 'student';
        });

        if (!filteredClasses || filteredClasses.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full p-16 flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <span class="material-symbols-outlined text-5xl mb-4 text-slate-300">event_busy</span>
                    <h3 class="text-lg font-bold text-slate-700 dark:text-slate-300">No Upcoming Classes</h3>
                    <p class="text-sm mt-1">There are currently no live sessions scheduled by faculty.</p>
                </div>
            `;
            return;
        }

        // Fetch faculty names
        const facultyIds = [...new Set(filteredClasses.map(c => c.faculty_id))];
        let facultyMap = {};
        if (facultyIds.length > 0) {
            const { data: facultyProfiles } = await window.supabase
                .from('users')
                .select('id, name')
                .in('id', facultyIds);
                
            if (facultyProfiles) {
                facultyProfiles.forEach(f => {
                    facultyMap[f.id] = f.name;
                });
            }
        }

        // Render Cards
        grid.innerHTML = filteredClasses.map(c => {
            const dateStr = new Date(c.class_date).toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'});
            const timeStr = c.class_time.substring(0, 5);
            
            return `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-6 hover:shadow-md transition-all">
                    <div class="flex items-start justify-between">
                        <div class="flex flex-col gap-1.5">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-primary dark:text-blue-400 text-xs font-bold w-fit mb-1">
                                <span class="material-symbols-outlined text-[14px]">schedule</span>
                                ${dateStr} • ${timeStr}
                            </span>
                            <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">${c.title}</h3>
                            <p class="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">${(c.description || '').replace(/\[T:.*?\]/g, '').replace(/\[M:.*?\]/g, '').replace(/\[S:.*?\]/g, '').trim() || 'No additional details provided.'}</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-5 mt-auto">
                        <div class="flex items-center gap-2 text-slate-400 text-sm font-semibold">
                            <span class="material-symbols-outlined text-[18px]">timelapse</span> ${c.duration_minutes} min
                        </div>
                        <button onclick="window.open('${c.meet_link}', '_blank')" class="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px]">videocam</span> Join Meet
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to load classes page:", err);
        grid.innerHTML = `<div class="col-span-full p-8 text-center text-red-500 font-bold bg-red-50 rounded-2xl">Error: Failed to load schedule. Check console.</div>`;
    }
}

window.loadAllClasses = loadAllClasses;
