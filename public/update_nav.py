import os
import re

files = ["classes.html", "chat.html", "quizzes.html", "my_exams.html", "notes.html"]
base_dir = "/Users/sbng/Desktop/ANTIGRAVITY/WEB college/public/"

standard_nav_core = """<nav class="flex-1 flex flex-col gap-1">
                    <a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="index.html">
                        <span class="material-symbols-outlined text-[22px]">dashboard</span>
                        <span>Dashboard</span>
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="classes.html">
                        <span class="material-symbols-outlined text-[22px]">school</span>
                        <span>Classes</span>
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="notes.html">
                        <span class="material-symbols-outlined text-[22px]">description</span>
                        <span>Study Notes</span>
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="my_exams.html">
                        <span class="material-symbols-outlined text-[22px]">history_edu</span>
                        <span>Skill Checks</span>
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="chat.html">
                        <span class="material-symbols-outlined text-[22px]">chat</span>
                        <span>Chat</span>
                    </a>
                </nav>"""

for file in files:
    fpath = os.path.join(base_dir, file)
    if not os.path.exists(fpath): continue
    
    with open(fpath, "r") as f:
        content = f.read()
    
    re_nav = re.compile(r'<nav class="flex-1 flex flex-col gap-1">.*?</nav>', re.DOTALL)
    
    if file == "notes.html":
        custom_nav = standard_nav_core.replace(
            '<a class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" href="notes.html">',
            '<a class="flex items-center gap-3 px-3 py-2 rounded-lg bg-primary/10 text-primary font-semibold" href="notes.html">'
        )
        content = re_nav.sub(custom_nav, content)
    else:
        content = re_nav.sub(standard_nav_core, content)

    with open(fpath, "w") as f:
        f.write(content)

print("Updated OK")
