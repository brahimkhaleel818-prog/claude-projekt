const ACTIVE_CLIENT_KEY = 'sag.activeClientId';

const state = {
  activeClientId: null,
  clients: []
};

function getStoredClientId() {
  const raw = localStorage.getItem(ACTIVE_CLIENT_KEY);
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function setStoredClientId(id) {
  if (id == null) localStorage.removeItem(ACTIVE_CLIENT_KEY);
  else localStorage.setItem(ACTIVE_CLIENT_KEY, String(id));
}

async function api(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.activeClientId) headers['X-Client-Id'] = String(state.activeClientId);
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function showClientError(message) {
  const el = document.getElementById('client-error');
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
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
        <button data-action="rename" data-id="${c.id}"
          class="text-xs px-2 py-1 rounded hover:bg-slate-700" title="Rename">edit</button>
        <button data-action="delete" data-id="${c.id}"
          class="text-xs px-2 py-1 rounded hover:bg-rose-500/20 text-rose-300" title="Delete">del</button>
      </div>
    `;
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

async function loadClients() {
  const data = await api('GET', '/api/clients');
  state.clients = data.clients;
  const storedId = getStoredClientId();
  const ids = new Set(state.clients.map(c => c.id));
  if (storedId && ids.has(storedId)) {
    state.activeClientId = storedId;
  } else {
    state.activeClientId = data.activeClientId;
    setStoredClientId(state.activeClientId);
  }
  renderActiveClient();
  renderClientList();
}

async function createClient(name) {
  const data = await api('POST', '/api/clients', { name });
  state.clients = data.clients;
  state.activeClientId = data.client.id;
  setStoredClientId(state.activeClientId);
  renderActiveClient();
  renderClientList();
}

async function renameClient(id, name) {
  const data = await api('PATCH', `/api/clients/${id}`, { name });
  state.clients = data.clients;
  renderActiveClient();
  renderClientList();
}

async function deleteClient(id) {
  const data = await api('DELETE', `/api/clients/${id}`);
  state.clients = data.clients;
  state.activeClientId = data.activeClientId;
  setStoredClientId(state.activeClientId);
  renderActiveClient();
  renderClientList();
}

function selectClient(id) {
  state.activeClientId = id;
  setStoredClientId(id);
  renderActiveClient();
  renderClientList();
  document.getElementById('client-switcher-panel').classList.add('hidden');
}

// --- health probe (unchanged behavior, now also sends client header) ---
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
  const output = document.getElementById('probe-output');
  output.textContent = 'loading...';
  try {
    const data = await fetchHealth();
    output.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    output.textContent = `Error: ${err.message}`;
  }
}

// --- wiring ---
function wireSwitcher() {
  const btn = document.getElementById('client-switcher-btn');
  const panel = document.getElementById('client-switcher-panel');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    showClientError(null);
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.add('hidden');
    }
  });

  document.getElementById('client-list').addEventListener('click', async (e) => {
    const target = e.target.closest('button[data-action]');
    if (!target) return;
    const id = Number.parseInt(target.dataset.id, 10);
    const action = target.dataset.action;
    showClientError(null);
    try {
      if (action === 'select') {
        selectClient(id);
      } else if (action === 'rename') {
        const current = state.clients.find(c => c.id === id);
        const name = prompt('Rename client', current?.name || '');
        if (name && name.trim()) await renameClient(id, name.trim());
      } else if (action === 'delete') {
        const current = state.clients.find(c => c.id === id);
        if (confirm(`Delete "${current?.name}"? This cascades to all its data.`)) {
          await deleteClient(id);
        }
      }
    } catch (err) {
      showClientError(err.message);
    }
  });

  document.getElementById('new-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('new-client-name');
    const name = input.value.trim();
    if (!name) return;
    showClientError(null);
    try {
      await createClient(name);
      input.value = '';
    } catch (err) {
      showClientError(err.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  wireSwitcher();
  document.getElementById('probe-btn').addEventListener('click', runProbe);
  state.activeClientId = getStoredClientId();
  await Promise.all([updateBadge(), loadClients().catch(err => showClientError(err.message))]);
});
