import { supabase } from './supabase-client.js';
import { academicData } from './notes-data.js';

const BUCKET_NAME = 'notes';

// ─── DOM refs ───────────────────────────────────────────────────────────────
const semesterFiltersEl  = document.getElementById('semester-filters');
const subjectSection     = document.getElementById('subject-section');
const subjectFiltersEl   = document.getElementById('subject-filters');
const subjectCountEl     = document.getElementById('subject-count');
const notesGrid          = document.getElementById('notes-grid');
const emptyState         = document.getElementById('empty-state');
const filterBreadcrumb   = document.getElementById('filter-breadcrumb');
const breadcrumbText     = document.getElementById('breadcrumb-text');
const notesCountBadge    = document.getElementById('notes-count-badge');
const clearFiltersBtn    = document.getElementById('clear-filters');
const uploadModal        = document.getElementById('upload-modal');
const modalBox           = document.getElementById('modal-box');
const openUploadBtn      = document.getElementById('open-upload-modal');
const emptyUploadBtn     = document.getElementById('empty-upload-btn');
const closeUploadBtn     = document.getElementById('close-upload-modal');
const uploadForm         = document.getElementById('upload-form');
const modalSemesterSel   = document.getElementById('modal-semester');
const modalSubjectSel    = document.getElementById('modal-subject');
const noteFileInput      = document.getElementById('note-file');
const fileNameDisplay    = document.getElementById('file-name-display');
const dropZone           = document.getElementById('drop-zone');

// ─── State ──────────────────────────────────────────────────────────────────
let activeSemester = null;
let activeSubject  = null;
let allNotes       = [];

// ─── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSemesterTabs();
    bindEvents();
    fetchAllNotes();
});

// ─── Event Bindings ─────────────────────────────────────────────────────────
function bindEvents() {
    openUploadBtn.addEventListener('click', openModal);
    emptyUploadBtn?.addEventListener('click', openModal);
    closeUploadBtn.addEventListener('click', closeModal);
    uploadModal.addEventListener('click', e => { if (e.target === uploadModal) closeModal(); });
    uploadForm.addEventListener('submit', handleUpload);
    modalSemesterSel.addEventListener('change', e => populateSubjectSelect(e.target.value));
    clearFiltersBtn.addEventListener('click', resetFilters);

    noteFileInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (f) {
            fileNameDisplay.textContent = f.name;
            fileNameDisplay.classList.add('text-primary', 'font-semibold');
            dropZone.classList.add('border-primary', 'bg-primary/5');
        }
    });
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function openModal() {
    uploadModal.classList.remove('hidden');
    uploadModal.classList.add('flex');
    requestAnimationFrame(() => {
        modalBox.classList.remove('scale-95', 'opacity-0');
        modalBox.classList.add('scale-100', 'opacity-100');
    });
}

function closeModal() {
    modalBox.classList.remove('scale-100', 'opacity-100');
    modalBox.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        uploadModal.classList.remove('flex');
        uploadModal.classList.add('hidden');
        uploadForm.reset();
        fileNameDisplay.textContent = 'Click to browse or drag & drop';
        fileNameDisplay.classList.remove('text-primary', 'font-semibold');
        dropZone.classList.remove('border-primary', 'bg-primary/5');
        populateSubjectSelect('');
    }, 200);
}

// ─── Semester Tabs ───────────────────────────────────────────────────────────
function renderSemesterTabs() {
    semesterFiltersEl.innerHTML = '';
    Object.keys(academicData).forEach(sem => {
        const btn = document.createElement('button');
        btn.className = 'sem-btn whitespace-nowrap px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-all';
        btn.textContent = sem;
        btn.addEventListener('click', () => selectSemester(sem, btn));
        semesterFiltersEl.appendChild(btn);
    });
}

function selectSemester(semester, btnEl) {
    if (activeSemester === semester) {
        // Toggle off
        resetFilters();
        return;
    }
    // Deactivate all
    document.querySelectorAll('.sem-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');

    activeSemester = semester;
    activeSubject  = null;

    renderSubjectPills(semester);
    subjectSection.classList.remove('hidden');
    clearFiltersBtn.classList.remove('hidden');
    updateBreadcrumb();
    filterAndDisplay();
}

// ─── Subject Pills ────────────────────────────────────────────────────────────
function renderSubjectPills(semester) {
    const subjects = academicData[semester] || [];
    subjectFiltersEl.innerHTML = '';
    subjectCountEl.textContent = `${subjects.length} subjects`;

    // All pill
    const allPill = makeSubjectPill('All Subjects', null, null);
    allPill.classList.add('active');
    subjectFiltersEl.appendChild(allPill);

    subjects.forEach(sub => {
        subjectFiltersEl.appendChild(makeSubjectPill(sub.name, sub.code, sub.name));
    });
}

function makeSubjectPill(label, code, value) {
    const btn = document.createElement('button');
    btn.className = 'subj-card flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-primary transition-all group';
    btn.innerHTML = code
        ? `<span class="subj-code text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-white transition-colors">${code}</span>
           <span class="subj-name text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-white transition-colors">${label}</span>`
        : `<span class="subj-name text-xs font-semibold text-slate-700 dark:text-slate-300">${label}</span>`;
    btn.addEventListener('click', () => selectSubject(value, btn));
    return btn;
}

function selectSubject(subjectValue, btnEl) {
    document.querySelectorAll('.subj-card').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    activeSubject = subjectValue;
    updateBreadcrumb();
    filterAndDisplay();
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────
function updateBreadcrumb() {
    if (!activeSemester) {
        filterBreadcrumb.classList.add('hidden');
        return;
    }
    filterBreadcrumb.classList.remove('hidden');
    breadcrumbText.textContent = activeSubject
        ? `${activeSemester}  ›  ${activeSubject}`
        : `${activeSemester}  ›  All subjects`;
}

function resetFilters() {
    activeSemester = null;
    activeSubject  = null;
    document.querySelectorAll('.sem-btn').forEach(b => b.classList.remove('active'));
    subjectSection.classList.add('hidden');
    subjectFiltersEl.innerHTML = '';
    clearFiltersBtn.classList.add('hidden');
    filterBreadcrumb.classList.add('hidden');
    renderNotesGrid(allNotes);
}

// ─── Fetch from Supabase ─────────────────────────────────────────────────────
async function fetchAllNotes() {
    showLoading();
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .order('uploaded_at', { ascending: false });
        if (error) throw error;
        allNotes = data || [];
        renderNotesGrid(allNotes);
    } catch (err) {
        notesGrid.innerHTML = `
            <div class="col-span-full flex items-center justify-center py-20">
                <div class="text-center">
                    <span class="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
                    <p class="text-sm font-bold text-red-500">Couldn't load notes</p>
                    <p class="text-xs text-slate-400 mt-1">${err.message}</p>
                </div>
            </div>`;
    }
}

function showLoading() {
    notesGrid.innerHTML = `
        <div class="col-span-full flex items-center justify-center py-20">
            <div class="flex flex-col items-center gap-3">
                <div class="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
                <p class="text-sm font-medium text-slate-400">Loading notes...</p>
            </div>
        </div>`;
    emptyState.classList.add('hidden');
}

// ─── Filter + Display ────────────────────────────────────────────────────────
function filterAndDisplay() {
    let filtered = allNotes;
    if (activeSemester) filtered = filtered.filter(n => n.semester === activeSemester);
    if (activeSubject)  filtered = filtered.filter(n => n.subject_name === activeSubject);
    renderNotesGrid(filtered);
}

function renderNotesGrid(notes) {
    notesGrid.innerHTML = '';

    if (notes.length === 0) {
        emptyState.classList.remove('hidden');
        notesCountBadge.textContent = '';
        return;
    }

    emptyState.classList.add('hidden');
    notesCountBadge.textContent = `${notes.length} note${notes.length > 1 ? 's' : ''}`;

    notes.forEach((note, i) => {
        const card = buildNoteCard(note, i);
        notesGrid.appendChild(card);
    });
}

function buildNoteCard(note, index) {
    const isPdf = note.file_url?.toLowerCase().includes('.pdf') || note.title?.toLowerCase().includes('pdf');
    const uploadedAt = note.uploaded_at
        ? new Date(note.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Unknown date';

    const card = document.createElement('div');
    card.className = 'note-card fade-in-item bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col';
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
        <!-- Card top accent -->
        <div class="h-1.5 w-full bg-gradient-to-r from-primary to-blue-400"></div>
        
        <!-- Card body -->
        <div class="flex-1 p-5 flex flex-col gap-3">
            <!-- File icon + type -->
            <div class="flex items-start justify-between">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center ${isPdf ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'}">
                    <span class="material-symbols-outlined text-xl ${isPdf ? 'text-red-500' : 'text-blue-500'}">${isPdf ? 'picture_as_pdf' : 'image'}</span>
                </div>
                <div class="text-right">
                    <span class="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">${note.semester?.replace('Semester ', 'Sem ') || ''}</span>
                </div>
            </div>
            
            <!-- Title -->
            <div class="flex-1">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">${note.title}</h3>
                <p class="text-[11px] text-slate-400 mt-1 font-medium">${note.course_code ? `${note.course_code} · ` : ''}${note.subject_name}</p>
            </div>
            
            <!-- Date + download count -->
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 dark:border-slate-800">
                <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">schedule</span>
                    ${uploadedAt}
                </span>
                <span class="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-bold">${isPdf ? 'PDF' : 'IMG'}</span>
            </div>
        </div>

        <!-- Card actions -->
        <div class="px-5 pb-5 flex gap-2.5">
            <button 
                data-url="${note.file_url}" 
                data-title="${note.title}"
                class="btn-download flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all">
                <span class="material-symbols-outlined text-[15px]">download</span>
                Download
            </button>
            <a 
                href="${note.file_url}" 
                target="_blank" 
                onclick="window.trackInteraction('notesViewed', '${note.title.replace(/'/g, "\\'")}')"
                class="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                <span class="material-symbols-outlined text-[15px]">open_in_new</span>
                View
            </a>
        </div>
    `;

    // Download handler — forces file save to disk
    card.querySelector('.btn-download').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const url = btn.dataset.url;
        const title = btn.dataset.title;
        btn.innerHTML = `<div class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Saving...`;
        btn.disabled = true;
        try {
            await forceDownload(url, title);
            window.trackInteraction('notesDownloaded', title);
        } catch (err) {
            console.error('Download failed:', err);
            alert('Could not download. Try opening the file using the View button.');
        } finally {
            btn.innerHTML = `<span class="material-symbols-outlined text-[15px]">download</span> Download`;
            btn.disabled = false;
        }
    });

    return card;
}

// ─── Force Download ──────────────────────────────────────────────────────────
async function forceDownload(url, title) {
    // Fetch the file as a blob (bypasses browser's open-in-tab behaviour)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Derive extension from URL or blob type
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase() || 'pdf';
    const safeName = `${title.replace(/[^a-z0-9 ]/gi, '_').trim()}.${ext}`;

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

// ─── Upload ──────────────────────────────────────────────────────────────────
function populateSubjectSelect(semester) {
    modalSubjectSel.innerHTML = '<option value="">Pick subject</option>';
    if (!semester) return;
    (academicData[semester] || []).forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.name;
        opt.dataset.code = sub.code;
        opt.textContent = `${sub.code} – ${sub.name}`;
        modalSubjectSel.appendChild(opt);
    });
}

async function handleUpload(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-upload');
    const orig = btn.innerHTML;

    const title       = document.getElementById('note-title').value.trim();
    const semester    = modalSemesterSel.value;
    const subjectName = modalSubjectSel.value;
    const file        = noteFileInput.files[0];
    const subjectCode = modalSubjectSel.options[modalSubjectSel.selectedIndex]?.dataset?.code || '';

    if (!title || !semester || !subjectName || !file) {
        alert('Please fill in all fields and choose a file.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> Uploading...`;

    try {
        // 1. Upload to storage
        const ext      = file.name.split('.').pop();
        const path     = `notes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: storageErr } = await supabase.storage.from(BUCKET_NAME).upload(path, file);
        if (storageErr) throw storageErr;

        // 2. Get public URL
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);

        // 3. Insert row
        const { error: dbErr } = await supabase.from('notes').insert([{
            title,
            semester,
            subject_name: subjectName,
            course_code: subjectCode,
            file_url: urlData.publicUrl
        }]);
        if (dbErr) throw dbErr;
        
        window.trackInteraction('notesUploaded', title);

        closeModal();
        await fetchAllNotes();

    } catch (err) {
        console.error('Upload error:', err);
        alert('Upload failed: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}
