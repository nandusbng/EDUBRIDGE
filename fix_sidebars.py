import re

files = ['public/mentor_notes.html', 'public/mentor_exams.html']

for file_path in files:
    with open(file_path, 'r') as f:
        html = f.read()

    # We need to replace:
    # href="#" data-tab="dashboard" class="nav-tab -> href="mentor.html?tab=dashboard" class="nav-link
    # but wait, earlier I might have removed 'nav-tab' from them? No, I ran sed to remove them from ALL? 
    # Ah, I reverted mentor.html manually. But mentor_notes and mentor_exams still have nav-tab for the inner links. Let's see.

    def replace_tab(match):
        tab = match.group(1)
        # make it a full link, remove data-tab and replace nav-tab with nav-link
        # wait, we can just change href="#" to href="mentor.html?tab=..."
        return f'href="mentor.html?tab={tab}" class="nav-link'

    # The links might look like: href="#" data-tab="dashboard" class="nav-tab
    # or: href="#" data-tab="dashboard" class=" flex
    # Let's just do a simple replace
    
    html = html.replace('href="#" data-tab="dashboard"', 'href="mentor.html?tab=dashboard"')
    html = html.replace('href="#" data-tab="requests"', 'href="mentor.html?tab=requests"')
    html = html.replace('href="#" data-tab="chat"', 'href="mentor.html?tab=chat"')
    html = html.replace('href="#" data-tab="announcements"', 'href="mentor.html?tab=announcements"')
    
    # Also we should strip nav-tab class strings if they are present, to avoid mentor.js attaching to them if it was included (which it isn't, but better safe).
    # Since these pages don't run setupTabs(), keeping nav-tab is harmless but changing to nav-link is clean.
    html = html.replace('nav-tab ', 'nav-link ')

    with open(file_path, 'w') as f:
        f.write(html)
    print(f"Fixed sidebar links in {file_path}")

