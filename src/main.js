const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// Enable Web MIDI
app.commandLine.appendSwitch('enable-features', 'WebMidi');
app.commandLine.appendSwitch('enable-web-midi');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
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

// loopMIDI launch handler
ipcMain.on('launch-loopmidi', (event) => {
  const loopMidiPaths = [
    'C:\\Program Files (x86)\\Tobias Erichsen\\loopMIDI\\loopMIDI.exe',
    'C:\\Program Files\\Tobias Erichsen\\loopMIDI\\loopMIDI.exe'
  ];

  const fs = require('fs');
  let exePath = null;
  for (const p of loopMidiPaths) {
    if (fs.existsSync(p)) { exePath = p; break; }
  }

  if (!exePath) {
    event.reply('loopmidi-status', { running: false, error: 'loopMIDI not found. Install from https://www.tobias-erichsen.de/software/loopmidi.html' });
    return;
  }

  try {
    const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    event.reply('loopmidi-status', { running: true, launched: true });
  } catch (err) {
    event.reply('loopmidi-status', { running: false, error: `Launch failed: ${err.message}` });
  }
});