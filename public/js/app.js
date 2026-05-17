const ACTIVE_CLIENT_KEY = 'sag.activeClientId';
const ACTIVE_SECTION_KEY = 'sag.activeSection';

const state = {
  activeClientId: null,
  clients: [],
  activeSection: 'health',
  brandKit: null
};

const SECTIONS = [
  { id: 'health', label: 'Overview' },
  { id: 'brand', label: 'Brand Setup' },
  { id: 'assets', label: 'Assets' },
  { id: 'templates', label: 'Templates' },
  { id: 'generate', label: 'Generate' },
  { id: 'history', label: 'History' },
  { id: 'intel', label: 'Brand Intel' },
  { id: 'campaigns', label: 'Campaigns' }
];

// ---------- storage ----------
function getStoredClientId() {
  const n = Number.parseInt(localStorage.getItem(ACTIVE_CLIENT_KEY), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}
function setStoredClientId(id) {
  if (id == null) localStorage.removeItem(ACTIVE_CLIENT_KEY);
  else localStorage.setItem(ACTIVE_CLIENT_KEY, String(id));
}

// ---------- fetch helper ----------
async function api(method, url, body, opts = {}) {
  const headers = {};
  if (!opts.formData) headers['Content-Type'] = 'application/json';
  if (state.activeClientId) headers['X-Client-Id'] = String(state.activeClientId);
  const res = await fetch(url, {
    method,
    headers,
    body: opts.formData ? body : body !== undefined ? JSON.stringify(body) : undefined
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}
window.api = api;

// ---------- escape ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
window.escapeHtml = escapeHtml;

// ---------- toast ----------
let toastTimer;
function showToast(msg, kind = 'ok') {
  const el = document.getElementById('autosave-toast');
  el.textContent = msg;
  el.className = `fixed bottom-6 right-6 text-xs px-3 py-2 rounded-lg border z-50 ${
    kind === 'ok'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
      : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  }`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1500);
}
window.showToast = showToast;

// ---------- sidebar ----------
function renderSidebar() {
  const nav = document.getElementById('sidebar');
  nav.innerHTML = SECTIONS.map(s => `
    <button data-section-id="${s.id}"
      class="sidebar-item w-full text-left px-3 py-2 rounded-lg text-sm transition ${
        s.id === state.activeSection
          ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/30'
          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
      }">
      ${s.label}
    </button>
  `).join('');
  nav.querySelectorAll('[data-section-id]').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.sectionId));
  });
}
function switchSection(id) {
  state.activeSection = id;
  localStorage.setItem(ACTIVE_SECTION_KEY, id);
  document.querySelectorAll('[data-section]').forEach(el => {
    el.classList.toggle('hidden', el.dataset.section !== id);
  });
  renderSidebar();
  if (sectionLoaders[id]) sectionLoaders[id]();
}
window.switchSection = switchSection;
const sectionLoaders = {};
window.registerSection = (id, loader) => { sectionLoaders[id] = loader; };

// ---------- client switcher ----------
function showClientError(message) {
  const el = document.getElementById('client-error');
  if (!message) { el.classList.add('hidden'); el.textContent = ''; return; }
  el.textContent = message;
  el.classList.remove('hidden');
}
function renderActiveClient() {
  const el = document.getElementById('active-client-name');
  const active = state.clients.find(c => c.id === state.activeClientId);
  el.textContent = active ? active.name : '—';
}
function renderClientList() {
  const ul = document.getElementById('client-list');
  ul.innerHTML = '';
  if (state.clients.length === 0) {
    ul.innerHTML = '<li class="text-sm text-slate-500 px-2 py-1">No clients yet.</li>';
    return;
  }
  for (const c of state.clients) {
    const li = document.createElement('li');
    const isActive = c.id === state.activeClientId;
    li.className = `group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
      isActive ? 'bg-indigo-500/15 border border-indigo-500/40' : 'hover:bg-slate-800'
    }`;
    li.innerHTML = `
      <button data-action="select" data-id="${c.id}"
        class="flex-1 text-left text-sm truncate">${escapeHtml(c.name)}</button>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button data-action="rename" data-id="${c.id}" class="text-xs px-2 py-1 rounded hover:bg-slate-700">edit</button>
        <button data-action="delete" data-id="${c.id}" class="text-xs px-2 py-1 rounded hover:bg-rose-500/20 text-rose-300">del</button>
      </div>
    `;
    ul.appendChild(li);
  }
}
async function loadClients() {
  const data = await api('GET', '/api/clients');
  state.clients = data.clients;
  const storedId = getStoredClientId();
  const ids = new Set(state.clients.map(c => c.id));
  if (storedId && ids.has(storedId)) state.activeClientId = storedId;
  else { state.activeClientId = data.activeClientId; setStoredClientId(state.activeClientId); }
  renderActiveClient();
  renderClientList();
}
async function createClient(name) {
  const data = await api('POST', '/api/clients', { name });
  state.clients = data.clients;
  state.activeClientId = data.client.id;
  setStoredClientId(state.activeClientId);
  renderActiveClient(); renderClientList();
  refreshActiveSection();
}
async function renameClient(id, name) {
  const data = await api('PATCH', `/api/clients/${id}`, { name });
  state.clients = data.clients;
  renderActiveClient(); renderClientList();
}
async function deleteClient(id) {
  const data = await api('DELETE', `/api/clients/${id}`);
  state.clients = data.clients;
  state.activeClientId = data.activeClientId;
  setStoredClientId(state.activeClientId);
  renderActiveClient(); renderClientList();
  refreshActiveSection();
}
function selectClient(id) {
  state.activeClientId = id;
  setStoredClientId(id);
  renderActiveClient(); renderClientList();
  document.getElementById('client-switcher-panel').classList.add('hidden');
  refreshActiveSection();
}
function refreshActiveSection() {
  if (sectionLoaders[state.activeSection]) sectionLoaders[state.activeSection]();
}
window.refreshActiveSection = refreshActiveSection;

// ---------- health ----------
async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function updateBadge() {
  const badge = document.getElementById('health-badge');
  try {
    const data = await fetchHealth();
    badge.textContent = data.status === 'ok' ? 'online' : data.status;
    badge.className = 'text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300';
  } catch {
    badge.textContent = 'offline';
    badge.className = 'text-xs px-3 py-1 rounded-full bg-rose-500/20 text-rose-300';
  }
}
async function runProbe() {
  const out = document.getElementById('probe-output');
  out.textContent = 'loading...';
  try { out.textContent = JSON.stringify(await fetchHealth(), null, 2); }
  catch (err) { out.textContent = `Error: ${err.message}`; }
}

// ---------- brand kit ----------
let brandSaveTimer;
function debounceBrandSave() {
  clearTimeout(brandSaveTimer);
  brandSaveTimer = setTimeout(saveBrandKit, 500);
}
function fillBrandForm(kit) {
  const f = document.getElementById('brand-kit-form');
  f.name.value = kit.name || '';
  f.tagline.value = kit.tagline || '';
  f.description.value = kit.description || '';
  const c = kit.colors || {};
  f['color-primary'].value = c.primary || '#6366f1';
  f['color-secondary'].value = c.secondary || '#1e293b';
  f['color-accent'].value = c.accent || '#f59e0b';
  const t = kit.typography || {};
  f['typo-primary'].value = t.primary || '';
  f['typo-secondary'].value = t.secondary || '';
  renderBrandPreview();
}
function renderBrandPreview() {
  const f = document.getElementById('brand-kit-form');
  document.getElementById('preview-name').textContent = f.name.value || 'Your brand';
  document.getElementById('preview-tagline').textContent = f.tagline.value || 'A short tagline lives here.';
  const p = f['color-primary'].value, s = f['color-secondary'].value, a = f['color-accent'].value;
  document.getElementById('brand-preview').style.background = s;
  document.getElementById('preview-name').style.color = p;
  document.getElementById('preview-tagline').style.color = a;
  document.getElementById('swatch-primary').style.background = p;
  document.getElementById('swatch-secondary').style.background = s;
  document.getElementById('swatch-accent').style.background = a;
  const fp = f['typo-primary'].value, fs = f['typo-secondary'].value;
  if (fp) document.getElementById('preview-name').style.fontFamily = fp;
  if (fs) document.getElementById('preview-tagline').style.fontFamily = fs;
}
async function loadBrandKit() {
  try {
    const { kit } = await api('GET', '/api/brand-kits');
    state.brandKit = kit;
    fillBrandForm(kit);
  } catch (err) { showToast(err.message, 'err'); }
}
async function saveBrandKit() {
  const f = document.getElementById('brand-kit-form');
  const payload = {
    name: f.name.value,
    tagline: f.tagline.value,
    description: f.description.value,
    colors: {
      primary: f['color-primary'].value,
      secondary: f['color-secondary'].value,
      accent: f['color-accent'].value
    },
    typography: {
      primary: f['typo-primary'].value,
      secondary: f['typo-secondary'].value
    }
  };
  try {
    const { kit } = await api('PATCH', '/api/brand-kits', payload);
    state.brandKit = kit;
    showToast('saved');
  } catch (err) { showToast(err.message, 'err'); }
}
function renderLogoPreviews(kit) {
  for (const v of ['light', 'dark']) {
    const el = document.getElementById(`logo-${v}-preview`);
    const url = v === 'dark' ? kit.logo_url_dark : kit.logo_url_light;
    if (url) {
      el.innerHTML = `<img src="${escapeHtml(url)}" class="max-h-full max-w-full object-contain" />`;
    } else {
      el.textContent = 'no logo';
    }
  }
}
async function uploadLogo(variant, file) {
  const fd = new FormData();
  fd.append('logo', file);
  const data = await api('POST', `/api/brand-kits/logo?variant=${variant}`, fd, { formData: true });
  state.brandKit = data.kit;
  renderLogoPreviews(data.kit);
  showToast(`${variant} logo uploaded`);
}
async function clearLogo(variant) {
  const data = await api('DELETE', `/api/brand-kits/logo?variant=${variant}`);
  state.brandKit = data.kit;
  renderLogoPreviews(data.kit);
  showToast(`${variant} logo removed`);
}
function wireLogoInputs() {
  document.querySelectorAll('input[data-logo-variant]').forEach(input => {
    if (input.dataset.wired) return;
    input.dataset.wired = '1';
    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { await uploadLogo(input.dataset.logoVariant, file); }
      catch (err) { showToast(err.message, 'err'); }
      e.target.value = '';
    });
  });
  document.querySelectorAll('button[data-logo-clear]').forEach(btn => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = '1';
    btn.addEventListener('click', async () => {
      try { await clearLogo(btn.dataset.logoClear); }
      catch (err) { showToast(err.message, 'err'); }
    });
  });
}

function wireBrandForm() {
  const f = document.getElementById('brand-kit-form');
  if (!f || f.dataset.wired) return;
  f.dataset.wired = '1';
  f.addEventListener('input', () => { renderBrandPreview(); debounceBrandSave(); });
  // tabs
  document.querySelectorAll('.brand-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.brand-tab').forEach(b => b.classList.remove('bg-slate-800'));
      btn.classList.add('bg-slate-800');
      const which = btn.dataset.tab;
      document.querySelectorAll('[data-brand-tab]').forEach(el => {
        el.classList.toggle('hidden', el.dataset.brandTab !== which);
      });
    });
  });
}
registerSection('brand', async () => {
  wireBrandForm();
  wireLogoInputs();
  await loadBrandKit();
  if (state.brandKit) renderLogoPreviews(state.brandKit);
});

// ---------- wiring ----------
function wireSwitcher() {
  const btn = document.getElementById('client-switcher-btn');
  const panel = document.getElementById('client-switcher-panel');
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.classList.toggle('hidden'); showClientError(null); });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) panel.classList.add('hidden');
  });
  document.getElementById('client-list').addEventListener('click', async (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;
    const id = Number.parseInt(target.dataset.id, 10);
    const action = target.dataset.action;
    showClientError(null);
    try {
      if (action === 'select') selectClient(id);
      else if (action === 'rename') {
        const current = state.clients.find(c => c.id === id);
        const name = prompt('Rename client', current?.name || '');
        if (name && name.trim()) await renameClient(id, name.trim());
      } else if (action === 'delete') {
        const current = state.clients.find(c => c.id === id);
        if (confirm(`Delete "${current?.name}"? This cascades to all its data.`)) await deleteClient(id);
      }
    } catch (err) { showClientError(err.message); }
  });
  document.getElementById('new-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-client-name');
    const name = input.value.trim();
    if (!name) return;
    showClientError(null);
    try { await createClient(name); input.value = ''; }
    catch (err) { showClientError(err.message); }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  state.activeSection = localStorage.getItem(ACTIVE_SECTION_KEY) || 'health';
  state.activeClientId = getStoredClientId();
  renderSidebar();
  switchSection(state.activeSection);
  wireSwitcher();
  document.getElementById('probe-btn').addEventListener('click', runProbe);
  await Promise.all([updateBadge(), loadClients().catch(err => showClientError(err.message))]);
  refreshActiveSection();
});
