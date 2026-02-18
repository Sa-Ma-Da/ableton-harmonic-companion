#!/usr/bin/env node
/**
 * Launch Script
 * =============
 * Verifies dependencies and launches the Electron application.
 * 
 * Usage: npm run launch
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');

// Verify critical files
const checks = [
    { file: 'src/main.js', label: 'Main process' },
    { file: 'index.html', label: 'UI entry point' },
    { file: 'package.json', label: 'Package manifest' }
];

let allOk = true;
for (const { file, label } of checks) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) {
        console.error(`❌ Missing ${label}: ${file}`);
        allOk = false;
    }
}

// Verify Electron
try {
    require.resolve('electron');
} catch {
    console.error('❌ Electron not installed. Run: npm install');
    allOk = false;
}

if (!allOk) {
    console.error('\n⚠️  Launch aborted — fix issues above.');
    process.exit(1);
}

console.log('✅ All dependencies verified.');
console.log('🚀 Launching Ableton Harmonic Companion...\n');

const electron = require('electron');
const child = spawn(electron, [ROOT], {
    stdio: 'inherit',
    windowsHide: false
});

child.on('error', (err) => {
    console.error(`❌ Launch failed: ${err.message}`);
    process.exit(1);
});

child.on('close', (code) => {
    process.exit(code || 0);
});
