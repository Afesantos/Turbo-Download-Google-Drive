const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  const iconPath = path.join(__dirname, '../public/favicon.ico');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DriveSync Turbo - Desktop',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler to create native folders and write files directly on Windows filesystem
ipcMain.handle('native-create-folder-and-write', async (event, { baseFolderPath, relativePath, fileName, fileBuffer }) => {
  try {
    const resolvedBase =
      !baseFolderPath || baseFolderPath === '__DOWNLOADS__'
        ? path.join(app.getPath('downloads'), 'DriveSync')
        : baseFolderPath;
    const sanitizedRelative = (relativePath || [])
      .map((s) => String(s).trim().replace(/[<>:"/\\|?*]/g, '_'))
      .filter((s) => s && s !== '.' && s !== '..');
    const sanitizedFile = String(fileName || 'arquivo').trim().replace(/[<>:"/\\|?*]/g, '_') || 'arquivo';
    const targetDir = path.join(resolvedBase, ...sanitizedRelative);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, sanitizedFile);
    fs.writeFileSync(filePath, Buffer.from(fileBuffer));
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC Handler to open destination folder in OS File Explorer / Finder
ipcMain.handle('native-open-folder', async (_event, folderNameOrPath) => {
  try {
    let targetPath = folderNameOrPath;
    if (!targetPath || targetPath.startsWith('Downloads / ')) {
      const sub = targetPath ? targetPath.replace('Downloads / ', '').trim() : '';
      const downloadsDir = app.getPath('downloads');
      const candidate = sub ? path.join(downloadsDir, sub) : downloadsDir;
      targetPath = fs.existsSync(candidate) ? candidate : downloadsDir;
    }
    const errMsg = await shell.openPath(targetPath);
    if (errMsg) {
      return { success: false, error: errMsg };
    }
    return { success: true, path: targetPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
