'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcmarket', {
  search: (query) => ipcRenderer.invoke('search-packages', query),
  info: (name) => ipcRenderer.invoke('package-info', name),
  listInstalled: () => ipcRenderer.invoke('list-installed'),
  listUpdates: () => ipcRenderer.invoke('list-updates'),
  install: (name) => ipcRenderer.invoke('install-package', name),
  remove: (name) => ipcRenderer.invoke('remove-package', name),
  updateAll: () => ipcRenderer.invoke('update-all'),
  checkAppUpdate: () => ipcRenderer.invoke('check-app-update'),
});
