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
// ---------- assets ----------
const assetState = { items: [], filter: '', q: '', recentlyUploaded: [] };

async function loadAssets() {
  const params = new URLSearchParams();
  if (assetState.filter) params.set('category', assetState.filter);
  if (assetState.q) params.set('q', assetState.q);
  const { assets } = await api('GET', `/api/assets?${params}`);
  assetState.items = assets;
  renderAssetGrid();
}
function renderAssetGrid() {
  const grid = document.getElementById('asset-grid');
  const empty = document.getElementById('asset-empty');
  empty.classList.toggle('hidden', assetState.items.length > 0);
  grid.innerHTML = assetState.items.map(a => `
    <div class="group relative rounded-lg overflow-hidden border border-slate-800 bg-slate-900 aspect-square">
      <img src="${escapeHtml(a.url)}" class="w-full h-full object-cover" loading="lazy" />
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/95 to-transparent p-2 text-xs">
        <div class="truncate" title="${escapeHtml(a.original_name || a.filename)}">${escapeHtml(a.original_name || a.filename)}</div>
        <div class="flex items-center justify-between mt-1">
          <span class="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">${escapeHtml(a.category)}</span>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100">
            <button data-asset-recategorize="${a.id}" class="px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600">tag</button>
            <button data-asset-delete="${a.id}" class="px-1.5 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50">del</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('[data-asset-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete asset?')) return;
    try { await api('DELETE', `/api/assets/${b.dataset.assetDelete}`); await loadAssets(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-asset-recategorize]').forEach(b => b.addEventListener('click', () => {
    assetState.recentlyUploaded = [Number(b.dataset.assetRecategorize)];
    openCategorizeModal(1);
  }));
}
function openCategorizeModal(count) {
  document.getElementById('categorize-count').textContent = count;
  document.getElementById('asset-categorize-modal').classList.remove('hidden');
}
function closeCategorizeModal() {
  document.getElementById('asset-categorize-modal').classList.add('hidden');
  assetState.recentlyUploaded = [];
}
async function applyCategoryToRecent(category) {
  if (!assetState.recentlyUploaded.length) { closeCategorizeModal(); return; }
  try {
    await api('POST', '/api/assets/bulk', { ids: assetState.recentlyUploaded, category });
    showToast(`tagged as ${category}`);
    closeCategorizeModal();
    await loadAssets();
  } catch (err) { showToast(err.message, 'err'); }
}
function wireAssetSection() {
  const input = document.getElementById('asset-upload');
  if (input.dataset.wired) return;
  input.dataset.wired = '1';
  input.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      const { assets } = await api('POST', '/api/assets', fd, { formData: true });
      assetState.recentlyUploaded = assets.map(a => a.id);
      await loadAssets();
      openCategorizeModal(assets.length);
    } catch (err) { showToast(err.message, 'err'); }
    e.target.value = '';
  });
  document.getElementById('asset-filter').addEventListener('change', (e) => {
    assetState.filter = e.target.value; loadAssets();
  });
  let qTimer;
  document.getElementById('asset-search').addEventListener('input', (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { assetState.q = e.target.value; loadAssets(); }, 250);
  });
  document.querySelectorAll('[data-categorize]').forEach(b => {
    b.addEventListener('click', () => applyCategoryToRecent(b.dataset.categorize));
  });
  document.getElementById('categorize-skip').addEventListener('click', closeCategorizeModal);
}
registerSection('assets', async () => { wireAssetSection(); await loadAssets(); });
window.assetState = assetState;
window.loadAssets = loadAssets;

// ---------- history ----------
const histState = { items: [], filter: '' };
async function loadHistory() {
  const params = new URLSearchParams();
  if (histState.filter) params.set('status', histState.filter);
  const { generations } = await api('GET', `/api/generations?${params}`);
  histState.items = generations;
  renderHistory();
}
function renderHistory() {
  const grid = document.getElementById('hist-grid');
  const empty = document.getElementById('hist-empty');
  empty.classList.toggle('hidden', histState.items.length > 0);
  grid.innerHTML = histState.items.map(g => {
    const imgs = Array.isArray(g.images) ? g.images : [];
    const cover = imgs[0]?.url;
    const statusBadge = g.status === 'succeeded' ? 'bg-emerald-500/20 text-emerald-300'
      : g.status === 'pending' ? 'bg-amber-500/20 text-amber-300 animate-pulse'
      : 'bg-rose-500/20 text-rose-300';
    return `
      <article class="group rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex flex-col">
        <div class="aspect-square bg-slate-950 relative">
          ${cover ? `<img src="${escapeHtml(cover)}" class="w-full h-full object-cover" loading="lazy" />`
            : g.status === 'failed'
              ? `<div class="absolute inset-0 flex items-center justify-center text-rose-300 text-xs p-3 text-center">${escapeHtml((g.error || 'failed').slice(0, 200))}</div>`
              : `<div class="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">working...</div>`}
          <span class="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full ${statusBadge}">${escapeHtml(g.status)}</span>
          ${imgs.length > 1 ? `<span class="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-950/80 text-slate-300">${imgs.length}</span>` : ''}
        </div>
        <div class="p-3 space-y-2 flex-1 flex flex-col">
          <p class="text-xs text-slate-400 line-clamp-3" title="${escapeHtml(g.prompt || '')}">${escapeHtml((g.prompt || '').slice(0, 200))}</p>
          <div class="text-[10px] text-slate-600 mt-auto">${new Date(g.created_at).toLocaleString()}</div>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
            <button data-hist-reprompt="${g.id}" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">re-prompt</button>
            <button data-hist-save-tpl="${g.id}" ${g.status !== 'succeeded' ? 'disabled' : ''} class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-indigo-500/30 disabled:opacity-40">save as template</button>
            <button data-hist-delete="${g.id}" class="text-xs px-2 py-1 rounded bg-rose-500/30 hover:bg-rose-500/50 ml-auto">del</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
  grid.querySelectorAll('[data-hist-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete generation?')) return;
    try { await api('DELETE', `/api/generations/${b.dataset.histDelete}`); await loadHistory(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-hist-save-tpl]').forEach(b => b.addEventListener('click', async () => {
    if (b.disabled) return;
    if (!window.saveGenerationAsTemplate) { showToast('Save as Template lands in the next phase', 'err'); return; }
    try { await window.saveGenerationAsTemplate(b.dataset.histSaveTpl); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-hist-reprompt]').forEach(b => b.addEventListener('click', async () => {
    if (!window.openRepromptModal) { showToast('Re-prompt lands in the next phase', 'err'); return; }
    window.openRepromptModal(Number(b.dataset.histReprompt));
  }));
}
function wireHistorySection() {
  const f = document.getElementById('hist-filter');
  if (f.dataset.wired) return;
  f.dataset.wired = '1';
  f.addEventListener('change', () => { histState.filter = f.value; loadHistory(); });
  document.getElementById('hist-refresh').addEventListener('click', () => loadHistory());
}
registerSection('history', async () => { wireHistorySection(); await loadHistory(); });
window.loadHistory = loadHistory;
window.openRepromptModal = function (parentId) {
  document.getElementById('reprompt-parent-id').textContent = parentId;
  document.getElementById('reprompt-instruction').value = '';
  document.getElementById('reprompt-modal').classList.remove('hidden');
  document.getElementById('reprompt-modal').dataset.parent = parentId;
};
function wireRepromptModal() {
  const modal = document.getElementById('reprompt-modal');
  if (modal.dataset.wired) return;
  modal.dataset.wired = '1';
  document.getElementById('reprompt-cancel').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('reprompt-submit').addEventListener('click', async () => {
    const parentId = Number(modal.dataset.parent);
    const instruction = document.getElementById('reprompt-instruction').value.trim();
    if (!instruction) return showToast('instruction required', 'err');
    const payload = {
      parent_generation_id: parentId,
      instruction,
      aspect_ratio: document.getElementById('reprompt-aspect').value,
      num_images: Number(document.getElementById('reprompt-num').value) || 1,
      reuse_image: document.getElementById('reprompt-reuse').checked
    };
    try {
      await api('POST', '/api/generate/edit', payload);
      modal.classList.add('hidden');
      showToast('variant generated');
      if (window.loadHistory) window.loadHistory();
    } catch (err) {
      showToast(err.message, 'err');
      if (window.loadHistory) window.loadHistory();
    }
  });
}
document.addEventListener('DOMContentLoaded', wireRepromptModal);

window.saveGenerationAsTemplate = async function (id) {
  const name = prompt('Template name', `Template from gen #${id}`);
  if (name == null) return;
  const category = prompt('Category', 'winner') || 'winner';
  await api('POST', `/api/generations/${id}/save-as-template`, { name, category });
  showToast('saved as template');
};

// ---------- reverse engineer ----------
window.openReverseModal = function (imageUrl) {
  document.getElementById('reverse-modal').classList.remove('hidden');
  document.getElementById('reverse-source').src = imageUrl;
  document.getElementById('reverse-output').innerHTML = '';
  document.getElementById('reverse-modal').dataset.src = imageUrl;
};
function wireReverseModal() {
  const m = document.getElementById('reverse-modal');
  if (m.dataset.wired) return;
  m.dataset.wired = '1';
  document.getElementById('reverse-close').addEventListener('click', () => m.classList.add('hidden'));
  document.getElementById('reverse-run').addEventListener('click', async () => {
    const imageUrl = m.dataset.src;
    const variant_count = Number(document.getElementById('reverse-count').value) || 3;
    const out = document.getElementById('reverse-output');
    const btn = document.getElementById('reverse-run');
    btn.disabled = true; btn.textContent = 'Analyzing...';
    out.innerHTML = '<div class="text-slate-400 text-xs animate-pulse">working…</div>';
    try {
      const data = await api('POST', '/api/prompt/reverse', { image_url: imageUrl, variant_count });
      out.innerHTML = `
        <div class="space-y-2">
          <div>
            <div class="text-xs uppercase text-slate-500">Style prompt</div>
            <div class="text-xs bg-slate-950 rounded-lg p-2 mt-1">${escapeHtml(data.style_prompt || '')}</div>
            <button data-rev-apply-base class="mt-1 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-indigo-500/30">Apply to generator</button>
          </div>
          ${data.variants?.length ? `<div><div class="text-xs uppercase text-slate-500">Variants</div>
            ${data.variants.map((v, i) => `
              <div class="text-xs bg-slate-950 rounded-lg p-2 mt-1 space-y-1">
                <div class="font-semibold text-slate-300">${escapeHtml(v.label || `Variant ${i + 1}`)}</div>
                <div>${escapeHtml(v.prompt || '')}</div>
                <button data-rev-apply-variant="${i}" class="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-indigo-500/30">Use this prompt</button>
              </div>
            `).join('')}</div>` : ''}
          ${data.copy_skeleton ? `<div><div class="text-xs uppercase text-slate-500">Copy skeleton</div>
            <pre class="text-xs bg-slate-950 rounded-lg p-2 mt-1 overflow-auto">${escapeHtml(JSON.stringify(data.copy_skeleton, null, 2))}</pre></div>` : ''}
        </div>
      `;
      const applyTo = (text) => {
        switchSection('generate');
        const form = document.getElementById('generate-form');
        form.prompt.value = text;
        showToast('applied to generator');
        m.classList.add('hidden');
      };
      out.querySelector('[data-rev-apply-base]')?.addEventListener('click', () => applyTo(data.style_prompt || ''));
      out.querySelectorAll('[data-rev-apply-variant]').forEach(b => {
        b.addEventListener('click', () => applyTo(data.variants[Number(b.dataset.revApplyVariant)]?.prompt || ''));
      });
    } catch (err) {
      out.innerHTML = `<div class="text-rose-300 text-xs">${escapeHtml(err.message)}</div>`;
    } finally { btn.disabled = false; btn.textContent = 'Analyze'; }
  });
}
document.addEventListener('DOMContentLoaded', wireReverseModal);

// ---------- campaigns / builder ----------
const builderState = {
  reference: '', product: '',
  profiles: new Set(),
  name: '', goal: '', adsPerProfile: 2, aspect: '1:1',
  plannedCampaign: null,
  list: []
};
const BUILDER_STEPS = [
  ['reference', 'Reference'], ['product', 'Product'],
  ['profiles', 'Profiles'], ['brief', 'Brief'], ['run', 'Generate']
];
function builderStepDone(step) {
  if (step === 'reference' || step === 'product') return true;
  if (step === 'profiles') return builderState.profiles.size > 0;
  if (step === 'brief') return builderState.name.trim() && builderState.goal.trim();
  if (step === 'run') return Boolean(builderState.plannedCampaign);
  return false;
}
function renderBuilderSteps() {
  const ol = document.getElementById('builder-steps');
  ol.innerHTML = BUILDER_STEPS.map(([k, label], i) => {
    const done = builderStepDone(k);
    return `<li class="px-3 py-2 rounded-lg border ${done ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-800 bg-slate-900 text-slate-400'}">
      <span class="font-mono">${i + 1}.</span> ${label}
    </li>`;
  }).join('');
  for (const [k] of BUILDER_STEPS) {
    const el = document.querySelector(`[data-step-status="${k}"]`);
    if (el) {
      if (k === 'profiles') el.textContent = builderState.profiles.size ? `${builderState.profiles.size} selected` : 'required';
      else if (k === 'brief') el.textContent = builderStepDone('brief') ? 'set' : 'required';
      else if (k === 'run') el.textContent = builderState.plannedCampaign ? `planned · ${builderState.plannedCampaign.plan.length} items` : 'last step';
      else el.textContent = (k === 'reference' && builderState.reference) || (k === 'product' && builderState.product) ? 'set' : 'optional';
    }
  }
  document.getElementById('builder-run').disabled = !builderState.plannedCampaign;
}
async function populateBuilderSelects() {
  const { assets } = await api('GET', '/api/assets');
  for (const which of ['reference', 'product']) {
    const sel = document.getElementById(`builder-${which}`);
    sel.innerHTML = '<option value="">— none —</option>' +
      assets.map(a => `<option value="${a.id}">${escapeHtml(a.original_name || a.filename)} (${escapeHtml(a.category)})</option>`).join('');
    sel.value = builderState[which];
  }
  const { profiles } = await api('GET', '/api/brand-intelligence');
  const list = document.getElementById('builder-profiles');
  if (!profiles.length) {
    list.innerHTML = '<p class="text-xs text-slate-500">No profiles yet. Create some in Brand Intelligence.</p>';
  } else {
    list.innerHTML = profiles.map(p => `
      <label class="flex items-start gap-2 text-sm p-2 rounded-lg hover:bg-slate-800/50 cursor-pointer">
        <input type="checkbox" value="${p.id}" ${builderState.profiles.has(p.id) ? 'checked' : ''} class="mt-1 accent-indigo-500" data-builder-profile />
        <span>
          <span class="font-medium">${escapeHtml(p.persona || '(unnamed)')}</span>
          <span class="text-slate-500 text-xs"> — ${escapeHtml(p.angle || '')}</span>
        </span>
      </label>
    `).join('');
    list.querySelectorAll('[data-builder-profile]').forEach(cb => {
      cb.addEventListener('change', () => {
        const id = Number(cb.value);
        if (cb.checked) builderState.profiles.add(id); else builderState.profiles.delete(id);
        builderState.plannedCampaign = null;
        renderBuilderSteps();
      });
    });
  }
  renderBuilderSteps();
}
async function loadCampaigns() {
  const { campaigns } = await api('GET', '/api/campaigns');
  builderState.list = campaigns;
  const list = document.getElementById('campaign-list');
  document.getElementById('campaign-empty').classList.toggle('hidden', campaigns.length > 0);
  list.innerHTML = campaigns.map(c => {
    const status = c.status;
    const cls = status === 'completed' ? 'text-emerald-300'
      : status === 'partial' ? 'text-amber-300'
      : status === 'failed' ? 'text-rose-300'
      : 'text-slate-400';
    return `<div class="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-sm">
      <div>
        <div class="font-medium">${escapeHtml(c.name)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(c.goal || '')} · ${(Array.isArray(c.plan) ? c.plan.length : 0)} items · <span class="${cls}">${escapeHtml(status)}</span></div>
      </div>
      <div class="flex gap-2">
        <button data-camp-run="${c.id}" class="text-xs px-2 py-1 rounded bg-indigo-500 hover:bg-indigo-400">Run</button>
        <button data-camp-del="${c.id}" class="text-xs px-2 py-1 rounded bg-rose-500/30 hover:bg-rose-500/50">del</button>
      </div>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-camp-run]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = '...';
    try { await api('POST', `/api/campaigns/${b.dataset.campRun}/generate`); showToast('campaign run'); await loadCampaigns(); if (window.loadHistory) window.loadHistory(); }
    catch (err) { showToast(err.message, 'err'); }
    finally { b.disabled = false; b.textContent = 'Run'; }
  }));
  list.querySelectorAll('[data-camp-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete campaign?')) return;
    try { await api('DELETE', `/api/campaigns/${b.dataset.campDel}`); await loadCampaigns(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
}
function wireBuilder() {
  if (document.getElementById('builder-plan').dataset.wired) return;
  document.getElementById('builder-plan').dataset.wired = '1';

  document.getElementById('builder-reference').addEventListener('change', e => {
    builderState.reference = e.target.value; builderState.plannedCampaign = null; renderBuilderSteps();
  });
  document.getElementById('builder-product').addEventListener('change', e => {
    builderState.product = e.target.value; builderState.plannedCampaign = null; renderBuilderSteps();
  });
  for (const [k, prop] of [['name', 'name'], ['goal', 'goal']]) {
    document.getElementById(`builder-${k}`).addEventListener('input', e => {
      builderState[prop] = e.target.value; builderState.plannedCampaign = null; renderBuilderSteps();
    });
  }
  document.getElementById('builder-ads').addEventListener('change', e => { builderState.adsPerProfile = Number(e.target.value) || 1; });
  document.getElementById('builder-aspect').addEventListener('change', e => { builderState.aspect = e.target.value; });

  document.getElementById('builder-plan').addEventListener('click', async () => {
    if (!builderState.profiles.size) return showToast('select at least one profile', 'err');
    const btn = document.getElementById('builder-plan');
    btn.disabled = true; btn.textContent = 'Planning...';
    try {
      const data = await api('POST', '/api/campaign/plan', {
        name: builderState.name || 'Untitled campaign',
        goal: builderState.goal,
        intelligence_ids: [...builderState.profiles],
        reference_asset_id: builderState.reference || null,
        product_asset_id: builderState.product || null,
        ads_per_profile: builderState.adsPerProfile,
        aspect_ratio: builderState.aspect
      });
      builderState.plannedCampaign = data.campaign;
      document.getElementById('builder-output').innerHTML =
        `<div class="text-emerald-300">Planned ${data.campaign.plan.length} ad items.</div>`;
      renderBuilderSteps();
      await loadCampaigns();
    } catch (err) { showToast(err.message, 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Plan campaign'; }
  });
  document.getElementById('builder-run').addEventListener('click', async () => {
    if (!builderState.plannedCampaign) return;
    const btn = document.getElementById('builder-run');
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      const data = await api('POST', `/api/campaigns/${builderState.plannedCampaign.id}/generate`);
      const ok = data.results.filter(r => r.status === 'succeeded').length;
      document.getElementById('builder-output').innerHTML =
        `<div>${ok}/${data.results.length} succeeded · campaign ${escapeHtml(data.campaign.status)}</div>`;
      showToast('batch run');
      await loadCampaigns();
      if (window.loadHistory) window.loadHistory();
    } catch (err) { showToast(err.message, 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Generate batch'; }
  });
}
registerSection('campaigns', async () => {
  wireBuilder();
  renderBuilderSteps();
  await Promise.all([populateBuilderSelects(), loadCampaigns()]);
});

// ---------- brand intelligence ----------
const intelState = { items: [] };
const INTEL_FIELDS = [
  ['persona', 'Persona'], ['pain_point', 'Pain point'], ['angle', 'Angle'],
  ['visual_direction', 'Visual direction'], ['emotion', 'Emotion'], ['copy_hook', 'Copy hook'],
  ['summary', 'Summary']
];
async function loadIntel() {
  const { profiles } = await api('GET', '/api/brand-intelligence');
  intelState.items = profiles;
  renderIntel();
}
function renderIntel() {
  const list = document.getElementById('intel-list');
  document.getElementById('intel-empty').classList.toggle('hidden', intelState.items.length > 0);
  list.innerHTML = intelState.items.map(p => `
    <article data-intel-id="${p.id}" class="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${p.source === 'ai' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-400'}">${escapeHtml(p.source || 'manual')}</span>
        <button data-intel-del="${p.id}" class="text-xs text-rose-300 hover:underline">delete</button>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${INTEL_FIELDS.map(([k, label]) => `
          <label class="block">
            <span class="text-[10px] uppercase tracking-wide text-slate-500">${label}</span>
            <textarea data-intel-field="${k}" rows="${k === 'summary' ? 2 : 1}"
              class="w-full mt-1 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-sm">${escapeHtml(p[k] || '')}</textarea>
          </label>
        `).join('')}
      </div>
    </article>
  `).join('');
  list.querySelectorAll('[data-intel-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete profile?')) return;
    try { await api('DELETE', `/api/brand-intelligence/${b.dataset.intelDel}`); await loadIntel(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  // inline-edit autosave
  list.querySelectorAll('article[data-intel-id]').forEach(art => {
    const id = Number(art.dataset.intelId);
    let timer;
    art.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const payload = {};
        art.querySelectorAll('[data-intel-field]').forEach(el => { payload[el.dataset.intelField] = el.value; });
        try { await api('PATCH', `/api/brand-intelligence/${id}`, payload); showToast('saved'); }
        catch (err) { showToast(err.message, 'err'); }
      }, 600);
    });
  });
}
async function addBlankProfile() {
  try {
    await api('POST', '/api/brand-intelligence', { source: 'manual', persona: '' });
    await loadIntel();
  } catch (err) { showToast(err.message, 'err'); }
}
function wireIntelSection() {
  if (document.getElementById('intel-add').dataset.wired) return;
  document.getElementById('intel-add').dataset.wired = '1';
  document.getElementById('intel-add').addEventListener('click', addBlankProfile);
  document.getElementById('intel-generate').addEventListener('click', () => {
    document.getElementById('intel-modal').classList.remove('hidden');
  });
  document.getElementById('intel-cancel').addEventListener('click', () => {
    document.getElementById('intel-modal').classList.add('hidden');
  });
  document.getElementById('intel-go').addEventListener('click', async () => {
    const research = document.getElementById('intel-research').value;
    const count = Number(document.getElementById('intel-count').value) || 3;
    const btn = document.getElementById('intel-go');
    btn.disabled = true; btn.textContent = 'Generating...';
    try {
      await api('POST', '/api/brand-intelligence/generate', { research, count });
      showToast('profiles generated');
      document.getElementById('intel-modal').classList.add('hidden');
      await loadIntel();
    } catch (err) { showToast(err.message, 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Generate'; }
  });
}
registerSection('intel', async () => { wireIntelSection(); await loadIntel(); });
window.intelState = intelState;
window.loadIntel = loadIntel;

// ---------- generate ----------
async function populateGenerateSelects() {
  try {
    const { assets } = await api('GET', '/api/assets');
    const form = document.getElementById('generate-form');
    for (const name of ['reference_asset_id', 'product_asset_id']) {
      const sel = form[name];
      const current = sel.value;
      sel.innerHTML = '<option value="">— none —</option>' +
        assets.map(a => `<option value="${a.id}">${escapeHtml(a.original_name || a.filename)} (${escapeHtml(a.category)})</option>`).join('');
      sel.value = current;
    }
  } catch (err) { showToast(err.message, 'err'); }
}
function renderGenerateOutput(gen) {
  const out = document.getElementById('generate-output');
  if (!gen) { out.innerHTML = 'No generation yet.'; return; }
  if (gen.status === 'failed') {
    out.innerHTML = `<div class="text-rose-300 text-sm">Failed: ${escapeHtml(gen.error || 'unknown error')}</div>`;
    return;
  }
  const imgs = Array.isArray(gen.images) ? gen.images : [];
  out.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      ${imgs.map(i => `<a href="${escapeHtml(i.url)}" target="_blank"><img src="${escapeHtml(i.url)}" class="rounded-lg w-full" /></a>`).join('')}
    </div>
    <div class="text-xs text-slate-500 mt-2">Status: ${escapeHtml(gen.status)}</div>
  `;
}
function wireGenerateForm() {
  const form = document.getElementById('generate-form');
  if (form.dataset.wired) return;
  form.dataset.wired = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('generate-btn');
    btn.disabled = true; btn.textContent = 'Generating...';
    const out = document.getElementById('generate-output');
    out.innerHTML = '<div class="text-slate-400 text-sm animate-pulse">working…</div>';
    const payload = {
      prompt: form.prompt.value,
      reference_asset_id: form.reference_asset_id.value || null,
      product_asset_id: form.product_asset_id.value || null,
      aspect_ratio: form.aspect_ratio.value,
      num_images: Number(form.num_images.value) || 1,
      apply_brand_kit: form.apply_brand_kit.checked
    };
    try {
      const data = await api('POST', '/api/generate', payload);
      renderGenerateOutput(data.generation);
      showToast('generated');
      if (window.loadHistory) window.loadHistory();
    } catch (err) {
      renderGenerateOutput(err.body?.generation || { status: 'failed', error: err.message });
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'Generate';
    }
  });
}
registerSection('generate', async () => { wireGenerateForm(); await populateGenerateSelects(); });

// ---------- templates ----------
const tplState = { items: [], q: '', favOnly: false };
async function loadTemplates() {
  const params = new URLSearchParams();
  if (tplState.q) params.set('q', tplState.q);
  if (tplState.favOnly) params.set('favorite', 'true');
  const { templates } = await api('GET', `/api/templates?${params}`);
  tplState.items = templates;
  renderTplGrid();
}
function renderTplGrid() {
  const grid = document.getElementById('tpl-grid');
  const empty = document.getElementById('tpl-empty');
  empty.classList.toggle('hidden', tplState.items.length > 0);
  grid.innerHTML = tplState.items.map(t => `
    <div class="group rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
      <div class="aspect-square bg-slate-950">
        ${t.image_url ? `<img src="${escapeHtml(t.image_url)}" class="w-full h-full object-cover" loading="lazy" />` : ''}
      </div>
      <div class="p-3 space-y-1">
        <div class="flex items-center justify-between gap-2">
          <div class="font-medium text-sm truncate">${escapeHtml(t.name)}</div>
          <button data-tpl-fav="${t.id}" data-current="${t.favorite}" class="text-xs ${t.favorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'}">★</button>
        </div>
        <div class="flex items-center justify-between gap-2 text-xs text-slate-500">
          <span class="truncate">${escapeHtml(t.category || '—')}</span>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100">
            <button data-tpl-reverse="${escapeHtml(t.image_url || '')}" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-indigo-500/30">reverse</button>
            <button data-tpl-rename="${t.id}" class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700">edit</button>
            <button data-tpl-delete="${t.id}" class="px-1.5 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50">del</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('[data-tpl-fav]').forEach(b => b.addEventListener('click', async () => {
    try { await api('PATCH', `/api/templates/${b.dataset.tplFav}`, { favorite: b.dataset.current !== 'true' }); await loadTemplates(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-tpl-rename]').forEach(b => b.addEventListener('click', async () => {
    const t = tplState.items.find(x => x.id === Number(b.dataset.tplRename));
    const name = prompt('Rename', t?.name || '');
    if (name == null) return;
    const category = prompt('Category', t?.category || '') || '';
    try { await api('PATCH', `/api/templates/${b.dataset.tplRename}`, { name, category: category || null }); await loadTemplates(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-tpl-delete]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete template?')) return;
    try { await api('DELETE', `/api/templates/${b.dataset.tplDelete}`); await loadTemplates(); }
    catch (err) { showToast(err.message, 'err'); }
  }));
  grid.querySelectorAll('[data-tpl-reverse]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.tplReverse) window.openReverseModal(b.dataset.tplReverse);
  }));
}
function wireTemplatesSection() {
  const up = document.getElementById('tpl-upload');
  if (up.dataset.wired) return;
  up.dataset.wired = '1';
  up.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    fd.append('name', file.name);
    try { await api('POST', '/api/templates', fd, { formData: true }); await loadTemplates(); showToast('uploaded'); }
    catch (err) { showToast(err.message, 'err'); }
    e.target.value = '';
  });
  let t;
  document.getElementById('tpl-search').addEventListener('input', e => {
    clearTimeout(t); t = setTimeout(() => { tplState.q = e.target.value; loadTemplates(); }, 250);
  });
  document.getElementById('tpl-fav-only').addEventListener('change', e => {
    tplState.favOnly = e.target.checked; loadTemplates();
  });
}
registerSection('templates', async () => { wireTemplatesSection(); await loadTemplates(); });
window.tplState = tplState;
window.loadTemplates = loadTemplates;

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
