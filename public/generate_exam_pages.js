const fs = require('fs');

// Generate Student Exam Page (my_exams.html)
let indexHtml = fs.readFileSync('public/index.html', 'utf8');

// The main area inside index.html starts at: <main class="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar relative min-h-screen">
// Or similar. Let's carve out the main content
let mainStart = indexHtml.indexOf('<main');
let mainEnd = indexHtml.indexOf('</main>') + 7;

let beforeMain = indexHtml.substring(0, mainStart);
let afterMain = indexHtml.substring(mainEnd);

let mainContent = `
        <main class="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar relative min-h-screen bg-slate-50 dark:bg-slate-900/50">
            <div class="max-w-7xl mx-auto space-y-6">
                <div>
                    <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Exam Assessments</h2>
                    <p class="text-slate-500 mt-1">Review pending assessments and access verified results.</p>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mt-8">
                    <h3 class="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                        <span class="material-symbols-outlined text-indigo-500">grading</span> Assigned Examinations
                    </h3>
                    
                    <div id="full-page-exams-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         <div class="col-span-full py-12 text-center text-slate-400 italic">Syncing assignments...</div>
                    </div>
                </div>
            </div>
        </main>
`;

let bodyEndIdx = afterMain.indexOf('</body>');
let scriptsToInject = `
    <script type="module" src="assets/js/my_exams.js"></script>
</body>`;
afterMain = afterMain.substring(0, bodyEndIdx) + scriptsToInject;

fs.writeFileSync('public/my_exams.html', beforeMain + mainContent + afterMain);


// Generate Mentor Exam Page (mentor_exams.html)
let mentorHtml = fs.readFileSync('public/mentor.html', 'utf8');
let mMainStart = mentorHtml.indexOf('<main');
let mMainEnd = mentorHtml.indexOf('</main>') + 7;

let mBeforeMain = mentorHtml.substring(0, mMainStart);
let mAfterMain = mentorHtml.substring(mMainEnd);

// Fix the active link highlight
mBeforeMain = mBeforeMain.replace(/class="nav-tab.*?bg-slate-50.*?"/, 'class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"');

let mMainContent = `
        <main class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-6 lg:p-10 relative no-scrollbar">
            <div class="max-w-7xl mx-auto space-y-6">
                <div>
                    <h2 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Mentor Exam Assessments</h2>
                    <p class="text-slate-500 mt-1">Review pending assessments assigned strictly to the Mentor cohort.</p>
                </div>

                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm mt-8">
                    <h3 class="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-6">
                        <span class="material-symbols-outlined text-indigo-500">grading</span> Assigned Examinations
                    </h3>
                    
                    <div id="full-page-exams-list" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div class="col-span-full py-12 text-center text-slate-400 italic">Syncing assignments...</div>
                    </div>
                </div>
            </div>
        </main>
`;

let mBodyEndIdx = mAfterMain.indexOf('</body>');
let mScriptsToInject = `
    <script type="module" src="assets/js/my_exams.js"></script>
</body>`;
mAfterMain = mAfterMain.substring(0, mBodyEndIdx) + mScriptsToInject;

fs.writeFileSync('public/mentor_exams.html', mBeforeMain + mMainContent + mAfterMain);

console.log("Pages generated");
