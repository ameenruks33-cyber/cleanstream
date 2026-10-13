const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('cleanstream', {
  desktop: true,
  adShield: {
    syncSettings: (settings) => ipcRenderer.invoke('adshield:sync', settings),
    getStats: () => ipcRenderer.invoke('adshield:stats'),
    updateLists: () => ipcRenderer.invoke('adshield:update-lists'),
  },
})
