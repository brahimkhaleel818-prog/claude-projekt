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
  } catch (err) {
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

document.addEventListener('DOMContentLoaded', () => {
  updateBadge();
  document.getElementById('probe-btn').addEventListener('click', runProbe);
});
