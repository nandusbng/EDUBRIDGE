files = ['public/mentor_notes.html', 'public/mentor_exams.html']

script_block = """
    <script type="module">
        import { supabase } from '/assets/js/supabase-client.js';
        document.addEventListener('DOMContentLoaded', async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                const display = profile?.name || session.user.email.split('@')[0];
                document.querySelectorAll('#mentor-name-display').forEach(el => el.textContent = display);
                document.querySelectorAll('#mentor-avatar').forEach(el => {
                    el.innerHTML = `<img src="${window.getAvatarUrl(session.user.email, 64)}" class="size-full rounded-2xl object-cover" alt="Profile">`;
                    el.innerText = '';
                });
            }
        });
    </script>
</body>"""

for f in files:
    with open(f, 'r') as file:
        content = file.read()
    if 'import { supabase }' not in content.split('<!-- Scripts -->')[-1]:
        content = content.replace('</body>', script_block)
        with open(f, 'w') as file:
            file.write(content)
        print(f"Fixed {f}")
