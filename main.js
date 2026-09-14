'use strict';
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const backend = require('./backend');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    title: 'ArcMarket+',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  watchForGitUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('search-packages', (_e, query) => backend.searchPackages(query));
ipcMain.handle('package-info', (_e, name, repo) => backend.packageInfo(name, repo));
ipcMain.handle('list-installed', () => backend.listInstalled());
ipcMain.handle('list-updates', () => backend.listUpdates());
ipcMain.handle('install-package', (_e, name) => backend.installPackage(name));
ipcMain.handle('remove-package', (_e, name) => backend.removePackage(name));
ipcMain.handle('update-all', () => backend.updateAll());
ipcMain.handle('check-app-update', () => checkGitUpdateNow());
ipcMain.handle('open-external', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

// Auto-update-on-run: a systemd timer (see systemd/) periodically git-pulls this
// repo in the background. When the local main branch ref changes underneath us,
// relaunch so the running app is always on the latest pushed commit.
function watchForGitUpdates() {
  const refFile = path.join(__dirname, '.git', 'refs', 'heads', 'main');
  if (!fs.existsSync(refFile)) return;
  let debounce;
  fs.watch(refFile, () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 500);
  });
}

function checkGitUpdateNow() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('git pull --ff-only', { cwd: __dirname }, (err, stdout) => {
      if (err) return resolve({ updated: false, error: err.message });
      const updated = !/Already up to date/i.test(stdout);
      resolve({ updated, output: stdout });
      if (updated) {
        setTimeout(() => {
          app.relaunch();
          app.exit(0);
        }, 500);
      }
    });
  });
}
