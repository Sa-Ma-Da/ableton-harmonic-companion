const { app, BrowserWindow } = require('electron');

// Enable Web MIDI
app.commandLine.appendSwitch('enable-features', 'WebMidi');
app.commandLine.appendSwitch('enable-web-midi');

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 500,
    backgroundColor: '#111111',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  win.loadFile('index.html');

  // DevTools: uncomment to auto-open on launch
  // win.webContents.openDevTools();

  // Grant MIDI permissions
  win.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (permission === 'midi' || permission === 'midiSysex') {
      console.log(`[Main] Permission Check Allowed: ${permission}`);
      return true;
    }
    // Filter out common default checks to avoid noise
    if (permission !== 'geolocation' && permission !== 'notifications') {
      console.log(`[Main] Permission Check Denied: ${permission}`);
    }
    return false;
  });

  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log(`[Main] Permission Request: ${permission}`);
    if (permission === 'midi' || permission === 'midiSysex') {
      return callback(true);
    }
    return callback(false);
  });
}

app.whenReady().then(createWindow);

const { ipcMain } = require('electron');
ipcMain.on('toggle-dev-tools', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.webContents.toggleDevTools();
});