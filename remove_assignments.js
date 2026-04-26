const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = fs.readdirSync('public').filter(f => f.endsWith('.html'));

files.forEach(file => {
    const p = path.join('public', file);
    let content = fs.readFileSync(p, 'utf8');
    
    // Remove the navigation link block
    content = content.replace(/<a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"\s*href="assignments\.html">\s*<span class="material-symbols-outlined text-\[22px\]">assignment<\/span>\s*<span>Assignments<\/span>\s*<\/a>/g, '');
    
    // For index.html: remove the pending assignments block and dashboard metric
    if (file === 'index.html') {
        // Pending assignments section removal
        const pendingSectionRegex = /<!-- Pending Assignments -->[\s\S]*?<!-- Recent Activity List -->/g;
        content = content.replace(pendingSectionRegex, '<!-- Recent Activity List -->');
        
        // Remove the Assignment stat card block
        const assignmentStatRegex = /<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">[\s\S]*?<p id="stat-assignmentsSubmitted"[\s\S]*?<\/div>\s*<\/div>/g;
        // Wait, easier to do by identifying the <p...Assignments</p>:
        content = content.replace(/<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">\s*<div class="flex items-center justify-between mb-4">\s*<div class="size-12 bg-emerald-50 dark:bg-emerald-900\/20 rounded-2xl flex items-center justify-center text-emerald-500">\s*<span class="material-symbols-outlined">assignment_turned_in<\/span>\s*<\/div>\s*<span class="text-emerald-500 bg-emerald-50 dark:bg-emerald-900\/20 text-xs font-bold px-2 py-1 rounded-lg">\+(\d+)%<\/span>\s*<\/div>\s*<div>\s*<p class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">\s*Assignments<\/p>\s*<p id="stat-assignmentsSubmitted"[\s\S]*?<\/div>\s*<\/div>/g, '');
    }
    
    fs.writeFileSync(p, content);
});

console.log("Done HTML replacements.");
