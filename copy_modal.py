import re

with open('public/notes.html', 'r') as f:
    notes_html = f.read()

# The modal starts with <!-- Upload Modal -->
# Since it's a sibling to <main>, we can split or find it precisely.
start = notes_html.find('<!-- Upload Modal -->')
end = notes_html.find('<!-- Scripts -->', start)
if start != -1 and end != -1:
    modal_content = notes_html[start:end]
else:
    print("Could not find modal content")
    exit(1)

with open('public/mentor_notes.html', 'r') as f:
    mentor_html = f.read()

# Insert the modal just before <!-- Scripts -->
if '<!-- Upload Modal -->' not in mentor_html:
    mentor_html = mentor_html.replace('<!-- Scripts -->', f'{modal_content}\n    <!-- Scripts -->')
    with open('public/mentor_notes.html', 'w') as f:
        f.write(mentor_html)
    print("Injected modal successfully.")
else:
    print("Modal already present?")

