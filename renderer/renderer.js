'use strict';

const statusBar = document.getElementById('status-bar');
function setStatus(msg) {
  statusBar.textContent = msg;
}

const REPO_CLASS = {
  aur: 'repo-aur',
  'chaotic-aur': 'repo-chaotic',
  archlinuxcn: 'repo-cn',
  cachyos: 'repo-cachyos',
  'cachyos-v3': 'repo-cachyos',
  'cachyos-extra-v3': 'repo-cachyos',
  'cachyos-core-v3': 'repo-cachyos',
  core: 'repo-official',
  extra: 'repo-official',
  multilib: 'repo-official',
};
function repoClass(repo) {
  return REPO_CLASS[repo] || 'repo-other';
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

let searchDebounce;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(doSearch, 350);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    clearTimeout(searchDebounce);
    doSearch();
  }
});
document.getElementById('search-btn').addEventListener('click', () => {
  clearTimeout(searchDebounce);
  doSearch();
});

let searchToken = 0;
async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchResults.innerHTML = '';
    return;
  }
  const token = ++searchToken;
  setStatus(`Searching for "${query}"...`);
  searchResults.innerHTML = '<li class="hint">Searching...</li>';
  try {
    const results = await window.arcmarket.search(query);
    if (token !== searchToken) return; // a newer search superseded this one
    searchResults.innerHTML = '';
    if (!results.length) {
      searchResults.innerHTML = '<li class="hint">No results.</li>';
    }
    for (const pkg of results) {
      searchResults.appendChild(renderPackageRow(pkg));
    }
    setStatus(`${results.length} result(s) for "${query}".`);
  } catch (e) {
    if (token !== searchToken) return;
    setStatus('Search failed: ' + e.message);
  }
}

function renderPackageRow(pkg) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div>
      <span class="name">${escapeHtml(pkg.name)}</span>
      ${pkg.installed ? '<span class="installed-badge">installed</span>' : ''}
      <span class="desc">${escapeHtml(pkg.description || '')}</span>
    </div>
    <span class="repo-tag ${repoClass(pkg.repo)}">${escapeHtml(pkg.repo)}</span>
  `;
  li.addEventListener('click', () => {
    document.querySelectorAll('#search-results li').forEach((el) => el.classList.remove('selected'));
    li.classList.add('selected');
    showDetail(pkg.name, pkg.repo);
  });
  return li;
}

async function showDetail(name, repo) {
  setStatus(`Loading info for ${name}...`);
  detailPane.innerHTML = '<p class="hint">Loading...</p>';
  try {
    const info = await window.arcmarket.info(name, repo);
    const isInstalled = Boolean(info['Installed Size'] || info['Install Reason']);
    const isAur = Boolean(info['Votes'] || info['Popularity']);
    const outOfDate = info['Out Of Date'] && !/^no$/i.test(info['Out Of Date'].trim());

    const skip = new Set(['Optional Deps']);
    const rows = Object.entries(info)
      .filter(([k]) => !skip.has(k))
      .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${linkifyField(k, v)}</dd>`)
      .join('');

    detailPane.innerHTML = `
      <h2>${escapeHtml(info.Name || name)}</h2>
      ${outOfDate ? `<div class="warning-banner">⚠ Flagged out-of-date upstream: ${escapeHtml(info['Out Of Date'])}</div>` : ''}
      <dl>${rows}</dl>
      <div class="detail-actions">
        ${
          isInstalled
            ? `<button class="remove-btn" data-name="${escapeHtml(name)}">Remove</button>`
            : `<button class="install-btn" data-name="${escapeHtml(name)}">Install</button>`
        }
        ${isAur ? `<button class="ghost-btn aur-link" data-name="${escapeHtml(name)}">View on AUR</button>` : ''}
      </div>
    `;
    setStatus(`Showing details for ${name}.`);

    detailPane.querySelector('.install-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      const n = btn.dataset.name;
      btn.disabled = true;
      btn.textContent = 'Launching...';
      const result = await window.arcmarket.install(n);
      if (result.launched) {
        setStatus(`Launched terminal to install ${n}. Enter your sudo password there.`);
        btn.textContent = 'Installing...';
      } else {
        setStatus(`Could not launch install for ${n}: ${result.error}`);
        btn.disabled = false;
        btn.textContent = 'Install';
      }
    });
    detailPane.querySelector('.remove-btn')?.addEventListener('click', async (e) => {
      const btn = e.target;
      const n = btn.dataset.name;
      btn.disabled = true;
      btn.textContent = 'Launching...';
      const result = await window.arcmarket.remove(n);
      if (result.launched) {
        setStatus(`Launched terminal to remove ${n}. Enter your sudo password there.`);
        btn.textContent = 'Removing...';
      } else {
        setStatus(`Could not launch removal for ${n}: ${result.error}`);
        btn.disabled = false;
        btn.textContent = 'Remove';
      }
    });
    detailPane.querySelector('.aur-link')?.addEventListener('click', (e) => {
      window.arcmarket.openExternal(`https://aur.archlinux.org/packages/${encodeURIComponent(e.target.dataset.name)}`);
    });
  } catch (e) {
    detailPane.innerHTML = `<p class="hint">Failed to load info: ${escapeHtml(e.message)}</p>`;
  }
}

function linkifyField(key, value) {
  if (key === 'URL' && /^https?:\/\//.test(value)) {
    return `<a href="#" class="ext-link" data-url="${escapeHtml(value)}">${escapeHtml(value)}</a>`;
  }
  return escapeHtml(value);
}
detailPane.addEventListener('click', (e) => {
  if (e.target.classList.contains('ext-link')) {
    e.preventDefault();
    window.arcmarket.openExternal(e.target.dataset.url);
  }
});

// ---- Installed ----
let installedCache = [];
async function loadInstalled() {
  const list = document.getElementById('installed-list');
  list.innerHTML = '<li class="hint">Loading...</li>';
  installedCache = await window.arcmarket.listInstalled();
  renderInstalled(installedCache);
  const badge = document.getElementById('installed-count');
  badge.textContent = installedCache.length;
  badge.hidden = false;
}

function renderInstalled(pkgs) {
  const list = document.getElementById('installed-list');
  list.innerHTML = '';
  if (!pkgs.length) {
    list.innerHTML = '<li class="hint">No matches.</li>';
    return;
  }
  for (const pkg of pkgs) {
    const li = document.createElement('li');
    li.innerHTML = `<div><span class="name">${escapeHtml(pkg.name)}</span></div><span class="repo-tag repo-other">${escapeHtml(pkg.version)}</span>`;
    li.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="search"]').click();
      showDetail(pkg.name);
    });
    list.appendChild(li);
  }
}

document.getElementById('installed-filter').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  renderInstalled(q ? installedCache.filter((p) => p.name.toLowerCase().includes(q)) : installedCache);
});

document.getElementById('refresh-installed-btn').addEventListener('click', loadInstalled);

// ---- Updates ----
async function loadUpdates() {
  const list = document.getElementById('updates-list');
  list.innerHTML = '<li class="hint">Checking...</li>';
  const updates = await window.arcmarket.listUpdates();
  list.innerHTML = '';
  const badge = document.getElementById('updates-count');
  if (!updates.length) {
    list.innerHTML = '<li class="hint">Everything is up to date.</li>';
    badge.hidden = true;
  } else {
    for (const u of updates) {
      const li = document.createElement('li');
      li.innerHTML = `<div><span class="name">${escapeHtml(u.name)}</span><span class="desc">${escapeHtml(u.from)} &rarr; ${escapeHtml(u.to)}</span></div>`;
      list.appendChild(li);
    }
    badge.textContent = updates.length;
    badge.hidden = false;
  }
}

document.getElementById('update-all-btn').addEventListener('click', async () => {
  const result = await window.arcmarket.updateAll();
  setStatus(result.launched ? 'Launched terminal to update all packages.' : `Could not launch update: ${result.error}`);
});
document.getElementById('refresh-updates-btn').addEventListener('click', loadUpdates);

// ---- App self-update (git pull) ----
document.getElementById('app-update-btn').addEventListener('click', async () => {
  setStatus('Checking for ArcMarket+ updates...');
  const result = await window.arcmarket.checkAppUpdate();
  if (result.error) setStatus('Update check failed: ' + result.error);
  else if (result.updated) setStatus('Updated! Relaunching...');
  else setStatus('ArcMarket+ is already up to date.');
});

// ---- Global keyboard shortcut: focus search from anywhere ----
window.addEventListener('keydown', (e) => {
  if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== searchInput) {
    e.preventDefault();
    document.querySelector('.tab[data-tab="search"]').click();
    searchInput.focus();
  }
});

// Populate the Updates badge in the background on startup without switching tabs.
loadUpdates();

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
