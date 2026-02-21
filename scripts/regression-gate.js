/**
 * REGRESSION GATE
 * ================
 * Post-build validation step.
 * 
 * After each feature implementation:
 * 1. Runs the full regression test suite
 * 2. If any baseline test fails:
 *    - Identifies the failing component
 *    - Reports which contract items regressed
 *    - Exits with error code (blocks build acceptance)
 * 
 * Usage:
 *   node scripts/regression-gate.js
 *   npm run test:gate
 * 
 * Exit Codes:
 *   0 = All baseline capabilities intact, build accepted
 *   1 = Regression detected, build rejected
 */

const { execSync } = require('child_process');
const path = require('path');

// ---- Configuration ----
const CONTRACT_FILE = 'tests/functional-contract.test.js';
const ALL_TEST_FILES = [
    'tests/harmonic-analyzer.test.js',
    'tests/integration.test.js',
    'tests/key-detector.test.js',
    'tests/functional-contract.test.js',
    'tests/behavioral-regression.test.js',
    'tests/suggestion-engine.test.js'
];

// Component mapping: test file → affected component
const COMPONENT_MAP = {
    'harmonic-analyzer.test.js': {
        component: 'Harmonic Analyzer',
        files: ['src/harmonic-analyzer.js', 'src/chord-dictionary.js'],
        description: 'Chord detection logic'
    },
    'midi-exporter.js': {
        component: 'MIDI Export',
        files: ['src/midi-exporter.js', 'src/note-utils.js'],
        description: 'MIDI file generation logic'
    },
    'midi-output.js': {
        component: 'MIDI Output',
        files: ['src/midi-output.js'],
        description: 'Real-time MIDI playback engine'
    },
    'integration.test.js': {
        component: 'MIDI Integration',
        files: ['src/midi-manager.js', 'src/harmonic-analyzer.js'],
        description: 'MIDI input → analysis pipeline'
    },
    'key-detector.test.js': {
        component: 'Key Detector',
        files: ['src/key-detector.js', 'src/scale-dictionary.js'],
        description: 'Key/scale inference from chord history'
    },
    'functional-contract.test.js': {
        component: 'Core Contract',
        files: ['src/renderer.js', 'src/midi-manager.js', 'src/harmonic-analyzer.js', 'src/key-detector.js', 'src/midi-exporter.js', 'src/modal-context.js', 'src/suggestion-engine.js', 'src/scale-dictionary.js', 'src/chord-dictionary.js', 'index.html'],
        description: '33 baseline UI/MIDI/analysis/export/modal/extension/voicing/scale/modal-stack/voice-leading capabilities'
    },
    'behavioral-regression.test.js': {
        component: 'Behavioral Regression',
        files: ['src/renderer.js', 'src/midi-manager.js', 'src/harmonic-analyzer.js', 'src/key-detector.js', 'src/note-utils.js', 'src/midi-exporter.js', 'src/modal-context.js', 'src/suggestion-engine.js', 'index.html'],
        description: 'Full application lifecycle: launch → enumerate → select → play → analyze → export → modal → candidate panel → extension drop → banks → voicing → live detection → modal stack → voice leading → bg toggle'
    },
    'suggestion-engine.test.js': {
        component: 'Suggestion Engine',
        files: ['src/suggestion-engine.js', 'src/scale-dictionary.js', 'src/chord-dictionary.js'],
        description: 'Harmonic suggestions: diatonic chords, scale recommendations, chord extensions, progression builder, chord metadata'
    }
};

// ---- Gate Logic ----

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║           REGRESSION GATE - BUILD CHECK          ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log('');

const failures = [];
const passes = [];

for (const testFile of ALL_TEST_FILES) {
    const basename = path.basename(testFile);
    const component = COMPONENT_MAP[basename] || { component: basename, files: [], description: '' };

    process.stdout.write(`  Testing: ${component.component.padEnd(25)}`);

    try {
        execSync(`npx jest ${testFile} --silent 2>&1`, {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'pipe',
            timeout: 30000
        });
        passes.push({ file: testFile, ...component });
        console.log('✅ PASS');
    } catch (err) {
        failures.push({
            file: testFile,
            ...component,
            output: err.stdout ? err.stdout.toString().slice(-500) : err.message
        });
        console.log('❌ FAIL');
    }
}

console.log('');
console.log('─'.repeat(52));

if (failures.length === 0) {
    console.log('');
    console.log('  ✅ BUILD ACCEPTED');
    console.log('  All baseline capabilities intact.');
    console.log(`  ${passes.length} test suites passed.`);
    console.log('');
    process.exit(0);
} else {
    console.log('');
    console.log('  ❌ BUILD REJECTED — REGRESSION DETECTED');
    console.log('');

    for (const fail of failures) {
        console.log(`  ┌─ FAILING COMPONENT: ${fail.component}`);
        console.log(`  │  Description: ${fail.description}`);
        console.log(`  │  Test File:   ${fail.file}`);
        console.log(`  │  Affected Files:`);
        for (const f of fail.files) {
            console.log(`  │    • ${f}`);
        }
        console.log('  │');
        console.log('  │  ACTION REQUIRED:');
        console.log('  │    1. Isolate newly introduced logic in the files above');
        console.log('  │    2. Rewrite the affected module to restore baseline behavior');
        console.log('  │    3. Rebuild and re-run: npm run test:gate');
        console.log('  └─');
        console.log('');
    }

    console.log('  The following must pass before build acceptance:');
    for (const fail of failures) {
        console.log(`    ✗ ${fail.component} (${fail.file})`);
    }
    console.log('');
    console.log('  Run the failing test in verbose mode for details:');
    for (const fail of failures) {
        console.log(`    npx jest ${fail.file} --verbose`);
    }
    console.log('');

    process.exit(1);
}
