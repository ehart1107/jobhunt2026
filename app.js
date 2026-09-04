/* ===================== CONFIG ===================== */

function applyConfig(){
  const cfg = (typeof DOCKET_CONFIG !== 'undefined') ? DOCKET_CONFIG : {};
  const title = cfg.siteTitle || 'The Docket';
  const tagline = cfg.siteTagline || 'One file per application.';
  const accent = cfg.accentColor || '#B4863F';

  document.title = title + ' — Job Application Tracker';
  const titleEl = document.getElementById('siteTitle');
  const taglineEl = document.getElementById('siteTagline');
  if (titleEl) titleEl.textContent = title;
  if (taglineEl) taglineEl.textContent = tagline;

  document.documentElement.style.setProperty('--brass', accent);
  // A soft tint of the accent for backgrounds (tabs, callout boxes) —
  // derived automatically so a fork only has to set one colour.
  document.documentElement.style.setProperty('--brass-soft', hexToSoftTint(accent));
}

function hexToSoftTint(hex){
  try{
    const c = hex.replace('#','');
    const r = parseInt(c.substring(0,2), 16);
    const g = parseInt(c.substring(2,4), 16);
    const b = parseInt(c.substring(4,6), 16);
    const mix = ch => Math.round(ch + (255 - ch) * 0.82);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
  }catch(e){ return '#F1E4CC'; }
}

function slugify(str){
  return (str || 'docket').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'docket';
}

/* ===================== DATA ===================== */

const STORAGE_KEY = 'docket.jobs.v1';

const DEFAULT_STAGE_ORDER = ['not_applied', 'applied', 'recruiter_call', 'stage_1', 'stage_2', 'stage_3', 'rejected'];
const DEFAULT_STAGE_LABELS = {
  not_applied:   'Not Applied',
  applied:       'Applied',
  recruiter_call:'Recruiter Call',
  stage_1:       'Stage 1',
  stage_2:       'Stage 2',
  stage_3:       'Stage 3',
  rejected:      'Rejected'
};

function loadJobs(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error('Could not read saved files', e);
    return [];
  }
}

function saveJobs(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.jobs));
}

function makeJob(url, company, role){
  const stageOrder = [...DEFAULT_STAGE_ORDER];
  const stageLabels = { ...DEFAULT_STAGE_LABELS };
  const stageNotes = {};
  stageOrder.forEach(id => stageNotes[id] = '');
  return {
    id: 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    url: url || '',
    company: company || '',
    role: role || '',
    dateAdded: new Date().toISOString(),
    facts: { pay:'', glassdoor:'', maternity:'', location:'', days:'', ats:'', other:'' },
    stageOrder,
    stageLabels,
    stageNotes,
    cvCallouts: '',
    currentStage: 'not_applied'
  };
}

/* ===================== STATE ===================== */

const state = {
  jobs: loadJobs(),
  selectedId: null,
  viewedStage: 'not_applied',
  searchTerm: ''
};

/* ===================== DOM REFS ===================== */

const fileList      = document.getElementById('fileList');
const searchInput    = document.getElementById('searchInput');
const emptyState     = document.getElementById('emptyState');
const fileView       = document.getElementById('fileView');

const companyInput   = document.getElementById('companyInput');
const roleInput      = document.getElementById('roleInput');
const urlLink        = document.getElementById('urlLink');
const editUrlBtn     = document.getElementById('editUrlBtn');
const deleteBtn      = document.getElementById('deleteBtn');

const factPay        = document.getElementById('factPay');
const factGlassdoor  = document.getElementById('factGlassdoor');
const factMaternity  = document.getElementById('factMaternity');
const factLocation   = document.getElementById('factLocation');
const factDays       = document.getElementById('factDays');
const factAts        = document.getElementById('factAts');
const factOther      = document.getElementById('factOther');

const stageTabs      = document.getElementById('stageTabs');
const stageNotes     = document.getElementById('stageNotes');
const notesLabel     = document.getElementById('notesLabel');
const cvCalloutsWrap = document.getElementById('cvCalloutsWrap');
const cvCallouts     = document.getElementById('cvCallouts');
const atsTips        = document.getElementById('atsTips');

const dropzone       = document.getElementById('dropzone');
const manualAddBtn   = document.getElementById('manualAddBtn');

const modalBackdrop  = document.getElementById('modalBackdrop');
const modalUrl       = document.getElementById('modalUrl');
const modalCompany   = document.getElementById('modalCompany');
const modalRole      = document.getElementById('modalRole');
const modalCancel    = document.getElementById('modalCancel');
const modalSave      = document.getElementById('modalSave');

const stageModalBackdrop = document.getElementById('stageModalBackdrop');
const stageNameInput     = document.getElementById('stageNameInput');
const stageModalCancel   = document.getElementById('stageModalCancel');
const stageModalSave     = document.getElementById('stageModalSave');

const exportBtn      = document.getElementById('exportBtn');
const importInput    = document.getElementById('importInput');

/* ===================== HELPERS ===================== */

function getJob(id){ return state.jobs.find(j => j.id === id); }

function guessCompanyFromUrl(url){
  try{
    const host = new URL(url).hostname.replace(/^www\./, '');
    const core = host.split('.')[0];
    return core.charAt(0).toUpperCase() + core.slice(1);
  }catch(e){ return ''; }
}

// Common ATS / careers platforms, matched by hostname. Pattern matching only —
// this isn't calling out to anything, so it's as reliable as the URL itself.
const ATS_PATTERNS = [
  { match: /(^|\.)greenhouse\.io$/,        name: 'Greenhouse' },
  { match: /(^|\.)lever\.co$/,             name: 'Lever' },
  { match: /myworkdayjobs\.com$/,          name: 'Workday' },
  { match: /(^|\.)workday\.com$/,          name: 'Workday' },
  { match: /(^|\.)icims\.com$/,            name: 'iCIMS' },
  { match: /(^|\.)smartrecruiters\.com$/,  name: 'SmartRecruiters' },
  { match: /(^|\.)taleo\.net$/,            name: 'Taleo (Oracle)' },
  { match: /oraclecloud\.com$/,            name: 'Oracle Recruiting Cloud' },
  { match: /(^|\.)ashbyhq\.com$/,          name: 'Ashby' },
  { match: /(^|\.)jobvite\.com$/,          name: 'Jobvite' },
  { match: /(^|\.)workable\.com$/,         name: 'Workable' },
  { match: /(^|\.)breezy\.hr$/,            name: 'Breezy HR' },
  { match: /applytojob\.com$/,             name: 'JazzHR' },
  { match: /(^|\.)recruitee\.com$/,        name: 'Recruitee' },
  { match: /personio\.(de|com)$/,          name: 'Personio' },
  { match: /(^|\.)teamtailor\.com$/,       name: 'Teamtailor' },
  { match: /comeet\.(co|com)$/,            name: 'Comeet' },
  { match: /recruiting\.paylocity\.com$/,  name: 'Paylocity' },
  { match: /workforcenow\.adp\.com$/,      name: 'ADP Workforce Now' },
  { match: /successfactors\.(com|eu)$/,    name: 'SAP SuccessFactors' },
  { match: /(^|\.)bamboohr\.com$/,         name: 'BambooHR' },
  { match: /(^|\.)clearcompany\.com$/,     name: 'ClearCompany' },
  { match: /(^|\.)avature\.net$/,          name: 'Avature' },
  { match: /(^|\.)eightfold\.ai$/,         name: 'Eightfold AI' },
  { match: /(^|\.)phenompeople\.com$/,     name: 'Phenom' },
  { match: /jobs\.jobvite\.com$/,          name: 'Jobvite' },
  { match: /(^|\.)careers-page\.com$/,     name: 'CareersPage' },
];

function detectATS(url){
  try{
    const host = new URL(url).hostname;
    const hit = ATS_PATTERNS.find(p => p.match.test(host));
    return hit ? hit.name : '';
  }catch(e){ return ''; }
}

// General, publicly-known tendencies of each platform's resume parser —
// not a guarantee for any specific employer's setup, since configuration
// varies. Framed as "check for" rather than absolute fact.
const ATS_CV_TIPS = {
  'Greenhouse': [
    'Generally one of the more forgiving parsers, but stick to a single column and standard section headings (Experience, Education, Skills).',
    'Avoid putting contact details only in a header/footer — some templates skip that region.'
  ],
  'Lever': [
    'Parses simple, single-column layouts most reliably.',
    'Keep contact info in the main body, not a header graphic.'
  ],
  'Workday': [
    'Known for struggling with multi-column layouts, tables, text boxes and graphics — use a single-column, plain layout.',
    'Put contact details in the body text, not a header/footer.',
    'Match section headings to common conventions exactly (e.g. "Work Experience", not a stylised variant) — Workday\'s field-mapping is literal.'
  ],
  'iCIMS': [
    'Sensitive to complex formatting — avoid tables, columns and text boxes.',
    'Use conventional section headings so fields map correctly.'
  ],
  'Taleo (Oracle)': [
    'One of the pickier legacy parsers — keep formatting as plain as possible, no tables or columns.',
    'If given a choice of file format, .docx has historically parsed more reliably than PDF on some Taleo instances — worth checking the posting\'s instructions.'
  ],
  'Oracle Recruiting Cloud': [
    'Shares lineage with Taleo\'s parsing quirks — favour plain, single-column formatting over anything visually elaborate.'
  ],
  'SAP SuccessFactors': [
    'Prefers plain formatting — avoid graphics, tables and multi-column layouts.'
  ],
  'SmartRecruiters': [
    'A more modern, generally forgiving parser, but standard single-column formatting is still the safest bet.'
  ],
  'Ashby': [
    'Modern parser, usually handles clean PDFs well — standard formatting still recommended over anything decorative.'
  ],
  'Eightfold AI': [
    'Matching leans more on semantic/keyword matching than strict field parsing — make sure skills and technologies from the job description appear in your own words somewhere in the CV.'
  ],
  'Phenom': [
    'Similar to other AI-matching platforms — prioritise having the job\'s key skills and terms genuinely reflected in your experience bullets.'
  ]
};

const DEFAULT_ATS_TIPS = [
  'Use standard section headings (Experience, Education, Skills) rather than creative alternatives.',
  'Avoid tables, multi-column layouts, text boxes and images for anything that matters — parsers often drop or scramble that content.',
  'Keep contact details in the main body of the document, not only in a header or footer.',
  'Mirror the exact wording of key skills and requirements from the posting where genuinely true of your experience.'
];

function getAtsTips(atsValue){
  const key = (atsValue || '').trim();
  const match = Object.keys(ATS_CV_TIPS).find(k => k.toLowerCase() === key.toLowerCase());
  return match ? ATS_CV_TIPS[match] : DEFAULT_ATS_TIPS;
}

// Best-effort guess at the role title from the URL path. ATS job URLs usually
// encode the title as a hyphenated slug — we pick the most "word-like"
// segment (most letters, most hyphens, not purely numeric) and title-case it.
function guessRoleFromUrl(url){
  try{
    const path = new URL(url).pathname;
    const segments = path.split('/')
      .map(s => decodeURIComponent(s || ''))
      .filter(s => s && !/^\d+$/.test(s));

    const STOPWORDS = new Set(['jobs','job','careers','career','apply','position','positions','opening','openings','req','vacancy','vacancies','en','en-us','gh','lever','uuid']);
    // Tokens that look like IDs rather than words: pure hex strings (UUID
    // chunks), or a short letter prefix glued to a run of digits (R00123,
    // req4021938) — common job-reference formats, not part of the title.
    const looksLikeId = w => /^[0-9a-f]{4,}$/i.test(w) || /^[a-z]{0,4}\d{3,}$/i.test(w);

    let best = '';
    let bestScore = -1;
    segments.forEach(seg => {
      const cleaned = seg.replace(/^\d+[-_]?/, ''); // strip leading numeric job id
      const words = cleaned.split(/[-_]+/).filter(Boolean);
      const meaningfulWords = words.filter(w => !STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w) && !looksLikeId(w));
      const score = meaningfulWords.length;
      if (score > bestScore && score >= 2){
        bestScore = score;
        best = meaningfulWords.join(' ');
      }
    });

    if (!best) return '';
    const MINOR_WORDS = new Set(['of','and','the','for','at','to','in','a','an','or','&']);
    return best.split(' ')
      .map((w, i) => {
        const lower = w.toLowerCase();
        if (i > 0 && MINOR_WORDS.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(' ');
  }catch(e){ return ''; }
}

function extractUrlFromDataTransfer(dt){
  const uriList = dt.getData('text/uri-list');
  if (uriList) return uriList.split('\n').find(l => l && !l.startsWith('#')) || '';
  const plain = dt.getData('text/plain');
  if (plain && /^https?:\/\//i.test(plain.trim())) return plain.trim();
  const html = dt.getData('text/html');
  if (html){
    const match = html.match(/href="([^"]+)"/i);
    if (match) return match[1];
  }
  return '';
}

/* ===================== RENDER: FILE LIST ===================== */

function renderFileList(){
  const term = state.searchTerm.trim().toLowerCase();
  const jobs = [...state.jobs]
    .filter(j => !term || (j.company + ' ' + j.role).toLowerCase().includes(term))
    .sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded));

  fileList.innerHTML = '';

  if (jobs.length === 0){
    const li = document.createElement('li');
    li.className = 'file-item-role';
    li.style.padding = '10px';
    li.textContent = state.jobs.length === 0 ? 'No files yet.' : 'No matches.';
    fileList.appendChild(li);
    return;
  }

  jobs.forEach(job => {
    const li = document.createElement('li');
    li.className = 'file-item' + (job.id === state.selectedId ? ' active' : '');
    li.setAttribute('role', 'button');
    li.tabIndex = 0;

    const label = job.stageLabels[job.currentStage] || job.currentStage;
    const isRejected = job.currentStage === 'rejected';

    li.innerHTML = `
      <span class="file-item-title">${escapeHtml(job.company || 'Untitled company')}</span>
      <span class="file-item-role">${escapeHtml(job.role || 'Role not set')}</span>
      <span class="file-item-stage${isRejected ? ' is-rejected' : ''}">${escapeHtml(label)}</span>
    `;
    li.addEventListener('click', () => selectJob(job.id));
    li.addEventListener('keydown', e => { if (e.key === 'Enter') selectJob(job.id); });
    fileList.appendChild(li);
  });
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ===================== RENDER: FILE VIEW ===================== */

function selectJob(id){
  state.selectedId = id;
  const job = getJob(id);
  state.viewedStage = job ? job.currentStage : 'not_applied';
  renderFileList();
  renderFileView();
}

function renderFileView(){
  const job = getJob(state.selectedId);

  if (!job){
    emptyState.hidden = false;
    fileView.hidden = true;
    return;
  }

  emptyState.hidden = true;
  fileView.hidden = false;

  companyInput.value = job.company;
  roleInput.value = job.role;
  urlLink.textContent = job.url || 'No link set';
  urlLink.href = job.url || '#';

  factPay.value = job.facts.pay;
  factGlassdoor.value = job.facts.glassdoor;
  factMaternity.value = job.facts.maternity;
  factLocation.value = job.facts.location;
  factDays.value = job.facts.days;
  factAts.value = job.facts.ats;
  factOther.value = job.facts.other;

  renderStageTabs(job);
  renderStagePane(job);
}

function renderStageTabs(job){
  stageTabs.innerHTML = '';
  const currentIndex = job.stageOrder.indexOf(job.currentStage);

  job.stageOrder.forEach((stageId, idx) => {
    if (stageId === 'rejected') return; // rendered after the "+" button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab';
    if (stageId === state.viewedStage) btn.classList.add('is-current');
    if (idx < currentIndex) btn.classList.add('is-passed');
    btn.textContent = job.stageLabels[stageId];
    btn.addEventListener('click', () => setViewedAndCurrentStage(job, stageId));
    stageTabs.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'tab-add';
  addBtn.title = 'Add another stage';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => openStageModal(job));
  stageTabs.appendChild(addBtn);

  const rejectedBtn = document.createElement('button');
  rejectedBtn.type = 'button';
  rejectedBtn.className = 'tab is-rejected';
  if (state.viewedStage === 'rejected') rejectedBtn.classList.add('is-current');
  rejectedBtn.textContent = job.stageLabels['rejected'];
  rejectedBtn.addEventListener('click', () => setViewedAndCurrentStage(job, 'rejected'));
  stageTabs.appendChild(rejectedBtn);
}

function setViewedAndCurrentStage(job, stageId){
  state.viewedStage = stageId;
  job.currentStage = stageId;
  saveJobs();
  renderFileList();
  renderStageTabs(job);
  renderStagePane(job);
}

function renderStagePane(job){
  const isNotApplied = state.viewedStage === 'not_applied';
  cvCalloutsWrap.hidden = !isNotApplied;
  if (isNotApplied){
    cvCallouts.value = job.cvCallouts || '';
    renderAtsTips(job);
  }

  notesLabel.textContent = `Notes — ${job.stageLabels[state.viewedStage] || state.viewedStage}`;
  stageNotes.value = job.stageNotes[state.viewedStage] || '';
}

function renderAtsTips(job){
  const atsValue = (job.facts.ats || '').trim();
  const tips = getAtsTips(atsValue);
  const heading = atsValue
    ? `Formatting to check for — ${escapeHtml(atsValue)}`
    : 'Formatting to check for — ATS not set';
  const note = atsValue && !Object.keys(ATS_CV_TIPS).some(k => k.toLowerCase() === atsValue.toLowerCase())
    ? '<p class="ats-tips-note">No specific notes on file for this platform — general ATS-safe guidance below.</p>'
    : '';
  atsTips.innerHTML = `
    <h4>${heading}</h4>
    ${note}
    <ul>${tips.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    <p class="ats-tips-caveat">General tendencies of the platform, not a guarantee for this specific employer's setup.</p>
  `;
}

function openStageModal(job){
  stageNameInput.value = '';
  stageModalBackdrop.hidden = false;
  stageNameInput.focus();
  stageModalBackdrop.dataset.jobId = job.id;
}

/* ===================== EVENTS: FILE HEADER + FACTS ===================== */

function bindLiveField(input, getter, setter){
  input.addEventListener('input', () => {
    const job = getJob(state.selectedId);
    if (!job) return;
    setter(job, input.value);
    saveJobs();
    if (input === companyInput || input === roleInput) renderFileList();
  });
}

bindLiveField(companyInput, null, (job, val) => job.company = val);
bindLiveField(roleInput, null, (job, val) => job.role = val);
bindLiveField(factPay, null, (job, val) => job.facts.pay = val);
bindLiveField(factGlassdoor, null, (job, val) => job.facts.glassdoor = val);
bindLiveField(factMaternity, null, (job, val) => job.facts.maternity = val);
bindLiveField(factLocation, null, (job, val) => job.facts.location = val);
bindLiveField(factDays, null, (job, val) => job.facts.days = val);
bindLiveField(factAts, null, (job, val) => job.facts.ats = val);
factAts.addEventListener('input', () => {
  const job = getJob(state.selectedId);
  if (job && state.viewedStage === 'not_applied') renderAtsTips(job);
});
bindLiveField(factOther, null, (job, val) => job.facts.other = val);

stageNotes.addEventListener('input', () => {
  const job = getJob(state.selectedId);
  if (!job) return;
  job.stageNotes[state.viewedStage] = stageNotes.value;
  saveJobs();
});

cvCallouts.addEventListener('input', () => {
  const job = getJob(state.selectedId);
  if (!job) return;
  job.cvCallouts = cvCallouts.value;
  saveJobs();
});

editUrlBtn.addEventListener('click', () => {
  const job = getJob(state.selectedId);
  if (!job) return;
  const next = prompt('Job posting URL', job.url || '');
  if (next === null) return;
  job.url = next.trim();
  saveJobs();
  renderFileView();
});

deleteBtn.addEventListener('click', () => {
  const job = getJob(state.selectedId);
  if (!job) return;
  const ok = confirm(`Delete the file for ${job.company || 'this role'}? This cannot be undone.`);
  if (!ok) return;
  state.jobs = state.jobs.filter(j => j.id !== job.id);
  state.selectedId = null;
  saveJobs();
  renderFileList();
  renderFileView();
});

/* ===================== EVENTS: STAGE MODAL ===================== */

stageModalCancel.addEventListener('click', () => stageModalBackdrop.hidden = true);

stageModalSave.addEventListener('click', () => {
  const jobId = stageModalBackdrop.dataset.jobId;
  const job = getJob(jobId);
  const name = stageNameInput.value.trim();
  if (!job || !name) return;

  const id = 'custom_' + Date.now();
  job.stageLabels[id] = name;
  job.stageNotes[id] = '';
  const rejIdx = job.stageOrder.indexOf('rejected');
  job.stageOrder.splice(rejIdx, 0, id);

  saveJobs();
  stageModalBackdrop.hidden = true;
  renderStageTabs(job);
});

/* ===================== EVENTS: SEARCH ===================== */

searchInput.addEventListener('input', () => {
  state.searchTerm = searchInput.value;
  renderFileList();
});

/* ===================== EVENTS: NEW FILE MODAL ===================== */

// Tracks the last value we auto-filled, so a live re-guess (as the URL
// field changes) doesn't clobber something the person typed themselves.
let modalLastGuessCompany = '';
let modalLastGuessRole = '';

function updateModalGuessesFromUrl(){
  const url = modalUrl.value.trim();
  if (!url) return;
  const companyGuess = guessCompanyFromUrl(url);
  const roleGuess = guessRoleFromUrl(url);

  if (companyGuess && (modalCompany.value === '' || modalCompany.value === modalLastGuessCompany)){
    modalCompany.value = companyGuess;
    modalLastGuessCompany = companyGuess;
  }
  if (roleGuess && (modalRole.value === '' || modalRole.value === modalLastGuessRole)){
    modalRole.value = roleGuess;
    modalLastGuessRole = roleGuess;
  }
}

modalUrl.addEventListener('input', updateModalGuessesFromUrl);

function openNewFileModal(url){
  modalUrl.value = url || '';
  modalCompany.value = '';
  modalRole.value = '';
  modalLastGuessCompany = '';
  modalLastGuessRole = '';
  modalBackdrop.hidden = false;
  if (url) updateModalGuessesFromUrl();
  // If a URL came in already (drag-and-drop), that field's done — send focus
  // to Company for confirmation. Otherwise this is a manual add, so the URL
  // field — the first one on the form — should be where typing starts.
  if (url) modalCompany.focus(); else modalUrl.focus();
}

manualAddBtn.addEventListener('click', () => openNewFileModal(''));
modalCancel.addEventListener('click', () => modalBackdrop.hidden = true);

modalSave.addEventListener('click', () => {
  const url = modalUrl.value.trim();
  const company = modalCompany.value.trim();
  const role = modalRole.value.trim();
  if (!company && !url){
    modalCompany.focus();
    return;
  }
  const job = makeJob(url, company, role);
  if (url) job.facts.ats = detectATS(url);
  state.jobs.push(job);
  saveJobs();
  modalBackdrop.hidden = true;
  selectJob(job.id);
});

/* ===================== DRAG AND DROP ===================== */

['dragenter','dragover'].forEach(evt => {
  dropzone.addEventListener(evt, e => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
});

['dragleave','dragend'].forEach(evt => {
  dropzone.addEventListener(evt, () => dropzone.classList.remove('drag-over'));
});

dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const url = extractUrlFromDataTransfer(e.dataTransfer);
  openNewFileModal(url);
});

// Also allow dropping a link anywhere on the window to land on the dropzone flow
window.addEventListener('dragover', e => e.preventDefault());

/* ===================== EXPORT / IMPORT ===================== */

exportBtn.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state.jobs, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const cfg = (typeof DOCKET_CONFIG !== 'undefined') ? DOCKET_CONFIG : {};
  a.download = slugify(cfg.siteTitle) + '-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

importInput.addEventListener('change', () => {
  const file = importInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming)) throw new Error('Not a valid backup file');
      const ok = confirm(`Import ${incoming.length} file(s)? This adds to your current files rather than replacing them.`);
      if (!ok) return;
      state.jobs.push(...incoming);
      saveJobs();
      renderFileList();
    }catch(err){
      alert('That file could not be read as a Docket backup.');
    }
    importInput.value = '';
  };
  reader.readAsText(file);
});

/* ===================== INIT ===================== */

applyConfig();
renderFileList();
renderFileView();
