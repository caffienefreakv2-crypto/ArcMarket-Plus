'use strict';
const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { env: { ...process.env, LANG: 'C' } });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    proc.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    proc.on('error', reject);
    proc.on('close', (code) => {
      // paru/pacman return non-zero for "no results" too; resolve anyway and let callers decide.
      resolve({ code, stdout, stderr });
    });
  });
}

function parseBlocks(text) {
  return text
    .split(/\n(?=\S)/)
    .map((b) => b.trim())
    .filter(Boolean);
}

// Parses `paru -Ss` / `pacman -Ss` style output into structured results.
function parseSearchResults(stdout) {
  const lines = stdout.split('\n');
  const results = [];
  for (let i = 0; i < lines.length; i++) {
    const headerMatch = lines[i].match(
      /^([^\s/]+)\/(\S+)\s+(\S+)(\s+\[installed[^\]]*\])?/
    );
    if (headerMatch) {
      const [, repo, name, version, installedTag] = headerMatch;
      const descLine = lines[i + 1] && lines[i + 1].startsWith('    ') ? lines[i + 1].trim() : '';
      results.push({
        repo,
        name,
        version,
        installed: Boolean(installedTag),
        description: descLine,
      });
    }
  }
  return results;
}

// Parses `paru -Si` / `pacman -Si` / `pacman -Qi` key/value blocks.
function parseInfoBlock(stdout) {
  const info = {};
  let lastKey = null;
  for (const rawLine of stdout.split('\n')) {
    if (!rawLine.trim()) continue;
    const kvMatch = rawLine.match(/^([A-Za-z][A-Za-z ]*?)\s*:\s?(.*)$/);
    if (kvMatch && rawLine.startsWith(kvMatch[1])) {
      lastKey = kvMatch[1].trim();
      info[lastKey] = kvMatch[2].trim();
    } else if (lastKey) {
      info[lastKey] += ' ' + rawLine.trim();
    }
  }
  return info;
}

async function searchPackages(query) {
  const { stdout } = await run('paru', ['-Ss', '--color=never', query]);
  return parseSearchResults(stdout);
}

async function packageInfo(name, repo) {
  // A package name can exist in more than one enabled repo (e.g. rebuilt in
  // both chaotic-aur and cachyos); `paru -Si` then prints one block per repo
  // back to back. Qualify with repo/name when known so we show the exact
  // package the user clicked, and only parse the first block otherwise.
  const target = repo ? `${repo}/${name}` : name;
  const { stdout, code } = await run('paru', ['-Si', '--color=never', target]);
  if (code === 0 && stdout.trim()) return parseInfoBlock(firstBlock(stdout));
  const local = await run('pacman', ['-Qi', name]);
  return parseInfoBlock(firstBlock(local.stdout));
}

function firstBlock(stdout) {
  return stdout.split(/\n\s*\n/)[0] || '';
}

async function listInstalled() {
  const { stdout } = await run('pacman', ['-Qe']);
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, version] = line.split(/\s+/);
      return { name, version };
    });
}

async function listUpdates() {
  const { stdout } = await run('paru', ['-Qu', '--color=never']);
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(\S+)\s+(\S+)\s+->\s+(\S+)/);
      if (!m) return null;
      return { name: m[1], from: m[2], to: m[3] };
    })
    .filter(Boolean);
}

function terminalCommand() {
  // Prefer KDE's terminal since privileged installs need an interactive TTY for sudo.
  const candidates = [
    { bin: 'konsole', wrap: (cmd) => ['-e', 'bash', '-lc', cmd] },
    { bin: 'xterm', wrap: (cmd) => ['-e', 'bash', '-lc', cmd] },
    { bin: 'x-terminal-emulator', wrap: (cmd) => ['-e', 'bash', '-lc', cmd] },
  ];
  return candidates;
}

async function runInTerminal(shellCmd) {
  const fullCmd = `${shellCmd}; echo; read -p 'Press Enter to close...'`;
  const unitName = `arcmarket-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  for (const { bin, wrap } of terminalCommand()) {
    try {
      // Launch as a transient systemd --user SERVICE (not `--scope`), which
      // asks the systemd user manager to fork+exec the process itself.
      // `--scope` instead re-parents an already-forked child of the caller
      // into a new cgroup, so it still inherits Electron/Chromium's
      // Linux no_new_privs flag, which blocks sudo's setuid escalation.
      // A genuine transient service is forked by systemd (no_new_privs=0),
      // so sudo works normally inside it.
      const proc = spawn(
        'systemd-run',
        ['--user', '--collect', `--unit=${unitName}`, '--', bin, ...wrap(fullCmd)],
        { detached: true, stdio: 'ignore' }
      );
      proc.unref();
      return { launched: true, terminal: bin };
    } catch (e) {
      // try next candidate
    }
  }
  return { launched: false, error: 'No terminal emulator found (tried konsole, xterm).' };
}

function installPackage(name) {
  return runInTerminal(`paru -S --skipreview ${shellEscape(name)}`);
}

function removePackage(name) {
  return runInTerminal(`paru -Rns ${shellEscape(name)}`);
}

function updateAll() {
  return runInTerminal('paru -Syu --skipreview');
}

function shellEscape(str) {
  return `'${String(str).replace(/'/g, `'\\''`)}'`;
}

module.exports = {
  searchPackages,
  packageInfo,
  listInstalled,
  listUpdates,
  installPackage,
  removePackage,
  updateAll,
};
