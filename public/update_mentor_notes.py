import re

with open('public/mentor_exams.html', 'r') as f:
    mentor_template = f.read()

with open('public/notes.html', 'r') as f:
    notes_html = f.read()

# Extract main tag content from notes.html
main_pattern = re.compile(r'<main[^>]*>(.*?)</main>', re.DOTALL)
notes_main_match = main_pattern.search(notes_html)
notes_main_content = notes_main_match.group(1) if notes_main_match else ""

# Also extract the upload modal which might be outside main
modal_pattern = re.compile(r'<!-- Upload Modal -->.*?</div>\s*</div>\s*</div>\s*</div>', re.DOTALL)
modal_match = modal_pattern.search(notes_html)
modal_content = modal_match.group(0) if modal_match else ""

# Replace main content in mentor_exams.html
new_html = re.sub(main_pattern, f'<main class="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-6 lg:p-10 relative no-scrollbar">\n{notes_main_content}\n</main>', mentor_template)

# Add modal content just before final scripts
new_html = new_html.replace('<!-- Scripts -->', f'{modal_content}\n\n    <!-- Scripts -->')

# Update script tags
new_html = new_html.replace('<script type="module" src="assets/js/my_exams.js"></script>', '<script type="module" src="assets/js/notes.js"></script>')
new_html = new_html.replace('Mentor Exam Assessments', 'Study Notes')

# Add "Study Notes" in sidebar
old_sidebar = """<a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""

new_sidebar = """<a href="mentor_notes.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <span class="material-symbols-outlined text-[20px]">description</span> Study Notes
                </a>
                <a href="mentor_exams.html" class="nav-tab flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                    <span class="material-symbols-outlined">history_edu</span> Assessment Hub
                </a>"""

new_html = new_html.replace(old_sidebar, new_sidebar)

with open('public/mentor_notes.html', 'w') as f:
    f.write(new_html)

print("Generated mentor_notes.html successfully!")
