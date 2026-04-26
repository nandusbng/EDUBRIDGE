import re
import glob

files = ['public/mentor.html', 'public/mentor_exams.html']

old_link = """<a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""

new_sidebar = """<a href="mentor_notes.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <span class="material-symbols-outlined text-[20px]">description</span> Study Notes
                </a>
                <a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""

for file in files:
    with open(file, 'r') as f:
        html = f.read()
    if 'mentor_notes.html' not in html:
        # handle case where mentor_exams has active class
        html = html.replace(old_link, new_sidebar)
        
        # if mentor_exams is active, the class is different
        old_link_active = """<a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""
        new_sidebar_active = """<a href="mentor_notes.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <span class="material-symbols-outlined text-[20px]">description</span> Study Notes
                </a>
                <a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""
        html = html.replace(old_link_active, new_sidebar_active)
        
        with open(file, 'w') as f:
            f.write(html)
        print(f"Updated {file}")
