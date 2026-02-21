#!/usr/bin/env node
/**
 * Version Bump Script
 * ===================
 * Increments version in version.json.
 *
 * Usage:
 *   node scripts/version-bump.js patch   →  0.1.0 → 0.1.1
 *   node scripts/version-bump.js minor   →  0.1.0 → 0.2.0
 */

const fs = require('fs');
const path = require('path');

const VFILE = path.resolve(__dirname, '..', 'version.json');
const bumpType = process.argv[2]; // 'patch' or 'minor'

if (!['patch', 'minor'].includes(bumpType)) {
    console.error('Usage: node scripts/version-bump.js [patch|minor]');
    process.exit(1);
}

let data;
try {
    data = JSON.parse(fs.readFileSync(VFILE, 'utf8'));
} catch {
    console.error('❌ Cannot read version.json');
    process.exit(1);
}

const parts = data.version.split('.').map(Number);
if (parts.length !== 3) {
    console.error(`❌ Invalid version format: ${data.version}`);
    process.exit(1);
}

if (bumpType === 'patch') {
    parts[2]++;
} else {
    parts[1]++;
    parts[2] = 0;
}

const newVersion = parts.join('.');
data.version = newVersion;
fs.writeFileSync(VFILE, JSON.stringify(data, null, 2) + '\n', 'utf8');

console.log(`✅ Version bumped: ${parts.join('.')} → ${newVersion}`);
console.log(`   Updated: version.json`);
