import { contextBridge, ipcRenderer } from 'electron';

// Expose protected APIs to renderer
contextBridge.exposeInMainWorld('electron', {
    getLocale: () => ipcRenderer.invoke('get-locale'),
    getBattery: () => ipcRenderer.invoke('get-battery'),
    getDisplaySettings: () => ipcRenderer.invoke('get-display-settings'),
    setDisplaySettings: (settings: any) => ipcRenderer.invoke('set-display-settings', settings),
    onDisplayChange: (callback: (settings: any) => void) => {
        const subscription = (_event: any, value: any) => callback(value);
        ipcRenderer.on('display-change', subscription);
        return () => ipcRenderer.removeListener('display-change', subscription);
    }
});


