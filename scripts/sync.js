#!/usr/bin/env node
/**
 * Git Sync Script
 * ===============
 * Pull → rebase → push without overwriting local work.
 *
 * Usage: npm run sync
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd) {
    console.log(`  $ ${cmd}`);
    try {
        execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
        return true;
    } catch (err) {
        console.error(`  ❌ Failed: ${cmd}`);
        return false;
    }
}

console.log('🔄 Syncing with remote...\n');

if (!run('git pull --rebase')) {
    console.error('\n⚠️  Pull/rebase failed. Resolve conflicts, then retry: npm run sync');
    process.exit(1);
}

if (!run('git push')) {
    console.error('\n⚠️  Push failed. Check remote access and retry.');
    process.exit(1);
}

console.log('\n✅ Sync complete — local and remote are aligned.');
