const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addAccount:    name       => ipcRenderer.invoke('accounts:add', name),
  switchAccount: id         => ipcRenderer.invoke('accounts:switch', id),
  deleteAccount: id         => ipcRenderer.invoke('accounts:delete', id),
  renameAccount: (id, name) => ipcRenderer.invoke('accounts:rename', { id, name }),
  navigate:      action     => ipcRenderer.invoke('nav', action),
  copyURL:       ()         => ipcRenderer.invoke('copy-url'),
  onInit:        cb         => ipcRenderer.on('init', (_, data) => cb(data)),
});
