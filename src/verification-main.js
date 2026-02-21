const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
    const win = new BrowserWindow({
        width: 600,
        height: 600,
        title: "Ableton Harmonic Companion - MIDI DIAGNOSTIC",
        backgroundColor: '#111',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    // Grant MIDI permissions
    win.webContents.session.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'midi' || permission === 'midiSysex') return true;
        return false;
    });

    win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        if (permission === 'midi' || permission === 'midiSysex') return callback(true);
        return callback(false);
    });

    win.loadFile(path.join(__dirname, 'verification.html'));
});
