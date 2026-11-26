const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveFileNative: (baseFolderPath, relativePath, fileName, fileBuffer) =>
    ipcRenderer.invoke('native-create-folder-and-write', {
      baseFolderPath,
      relativePath,
      fileName,
      fileBuffer,
    }),
  openFolder: (folderPath) => ipcRenderer.invoke('native-open-folder', folderPath),
});
