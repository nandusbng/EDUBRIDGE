import os, re

def main():
    for file in os.listdir('public'):
        if file.endswith('.html'):
            path = os.path.join('public', file)
            with open(path, 'r') as f:
                content = f.read()
            
            # Remove Nav link
            content = re.sub(r'<a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"\s*href="assignments\.html">\s*<span class="material-symbols-outlined text-\[22px\]">assignment</span>\s*<span>Assignments</span>\s*</a>\n?', '', content, flags=re.MULTILINE)
            
            if file == 'index.html':
                content = re.sub(r'<!-- Pending Assignments -->.*?<!-- Recent Activity List -->', '<!-- Recent Activity List -->', content, flags=re.DOTALL)
                content = re.sub(r'<div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">\s*<div class="flex items-center justify-between mb-4">\s*<div class="size-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center text-emerald-500">\s*<span class="material-symbols-outlined">assignment_turned_in</span>\s*</div>\s*<span class="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-xs font-bold px-2 py-1 rounded-lg">\+\d+%</span>\s*</div>\s*<div>\s*<p class="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">\s*Assignments</p>\s*<p id="stat-assignmentsSubmitted"[^>]*>.*?</p>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
                
            with open(path, 'w') as f:
                f.write(content)
    print("Done HTML replacements.")

if __name__ == '__main__':
    main()
