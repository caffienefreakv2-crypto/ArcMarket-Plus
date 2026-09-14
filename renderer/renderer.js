'use strict';

const statusBar = document.getElementById('status-bar');
function setStatus(msg) {
  statusBar.textContent = msg;
}

// ---- Tabs ----
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'installed') loadInstalled();
    if (btn.dataset.tab === 'updates') loadUpdates();
  });
});

// ---- Search ----
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const detailPane = document.getElementById('detail-pane');

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;
  setStatus(`Searching for "${query}"...`);
  searchResults.innerHTML = '';
  try {
    const results = await window.arcmarket.search(query);
    if (!results.length) {
      searchResults.innerHTML = '<li class="hint">No results.</li>';
    }
    for (const pkg of results) {
      searchResults.appendChild(renderPackageRow(pkg));
    }
    setStatus(`${results.length} result(s) for "${query}".`);
  } catch (e) {
    setStatus('Search failed: ' + e.message);
  }
}

document.getElementById('search-btn').addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

function renderPackageRow(pkg) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div>
      <span class="name">${escapeHtml(pkg.name)}</span>
      <span class="desc">${escapeHtml(pkg.description || '')}</span>
    </div>
    <span class="repo-tag">${escapeHtml(pkg.repo)}</span>
  `;
  li.addEventListener('click', () => showDetail(pkg.name));
  return li;
}

async function showDetail(name) {
  setStatus(`Loading info for ${name}...`);
  detailPane.innerHTML = '<p class="hint">Loading...</p>';
  try {
    const info = await window.arcmarket.info(name);
    const isInstalled = Boolean(info['Installed Size'] || info['Install Reason']);
    const rows = Object.entries(info)
      .filter(([k]) => !['Optional Deps'].includes(k))
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
      .join('');
    detailPane.innerHTML = `
      <h2>${escapeHtml(info.Name || name)}</h2>
      <dl>${rows}</dl>
      ${
        isInstalled
          ? `<button class="remove-btn" data-name="${escapeHtml(name)}">Remove</button>`
          : `<button class="install-btn" data-name="${escapeHtml(name)}">Install</button>`
      }
    `;
    setStatus(`Showing details for ${name}.`);
    detailPane.querySelector('.install-btn')?.addEventListener('click', (e) => {
      const n = e.target.dataset.name;
      window.arcmarket.install(n);
      setStatus(`Launched terminal to install ${n}. Enter your sudo password there.`);
    });
    detailPane.querySelector('.remove-btn')?.addEventListener('click', (e) => {
      const n = e.target.dataset.name;
      window.arcmarket.remove(n);
      setStatus(`Launched terminal to remove ${n}. Enter your sudo password there.`);
    });
  } catch (e) {
    detailPane.innerHTML = `<p class="hint">Failed to load info: ${escapeHtml(e.message)}</p>`;
  }
}

// ---- Installed ----
async function loadInstalled() {
  const list = document.getElementById('installed-list');
  list.innerHTML = '<li class="hint">Loading...</li>';
  const pkgs = await window.arcmarket.listInstalled();
  list.innerHTML = '';
  for (const pkg of pkgs) {
    const li = document.createElement('li');
    li.innerHTML = `<div><span class="name">${escapeHtml(pkg.name)}</span></div><span class="repo-tag">${escapeHtml(pkg.version)}</span>`;
    li.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="search"]').click();
      showDetail(pkg.name);
    });
    list.appendChild(li);
  }
}

// ---- Updates ----
async function loadUpdates() {
  const list = document.getElementById('updates-list');
  list.innerHTML = '<li class="hint">Checking...</li>';
  const updates = await window.arcmarket.listUpdates();
  list.innerHTML = '';
  if (!updates.length) {
    list.innerHTML = '<li class="hint">Everything is up to date.</li>';
    return;
  }
  for (const u of updates) {
    const li = document.createElement('li');
    li.innerHTML = `<div><span class="name">${escapeHtml(u.name)}</span><span class="desc">${escapeHtml(u.from)} &rarr; ${escapeHtml(u.to)}</span></div>`;
    list.appendChild(li);
  }
}

document.getElementById('update-all-btn').addEventListener('click', () => {
  window.arcmarket.updateAll();
  setStatus('Launched terminal to update all packages.');
});

// ---- App self-update (git pull) ----
document.getElementById('app-update-btn').addEventListener('click', async () => {
  setStatus('Checking for ArcMarket+ updates...');
  const result = await window.arcmarket.checkAppUpdate();
  if (result.error) setStatus('Update check failed: ' + result.error);
  else if (result.updated) setStatus('Updated! Relaunching...');
  else setStatus('ArcMarket+ is already up to date.');
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
