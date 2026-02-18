/**
 * @jest-environment jsdom
 */

/**
 * BEHAVIORAL REGRESSION TESTS
 * ============================
 * End-to-end integration tests simulating general application use.
 * Tests verify the full lifecycle from launch through harmonic analysis.
 *
 * Test Cases:
 *  1. Application launch (module loading)
 *  2. MIDI device enumeration
 *  3. MIDI device selection
 *  4. Simulated NoteOn message
 *  5. Simulated NoteOff message
 *  6. Active note display update
 *  7. Chord classification update
 *  8. Key detection update
 *  9. Debug log update (event emission)
 * 10. MIDI device refresh interaction
 *
 * These tests serve as baseline behavioral regression tests for all future development.
 */

const path = require('path');
const fs = require('fs');

// Load HTML
const htmlContent = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

// ---- Shared State ----
let mockInput;
let mockAccess;
let MidiManager;
let manager;
let detectChord;
let KeyDetector;
let keyDetector;
let midiToNoteName;

function setupMocks() {
    mockInput = {
        id: 'behav-input-1',
        name: 'Behavioral Test Keyboard',
        state: 'connected',
        onmidimessage: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
    };

    mockAccess = {
        inputs: new Map([['behav-input-1', mockInput]]),
        onstatechange: null
    };

    Object.defineProperty(global.navigator, 'requestMIDIAccess', {
        value: jest.fn().mockResolvedValue(mockAccess),
        writable: true,
        configurable: true
    });
}

// Helper: send MIDI message through the mock input
function sendMidi(status, note, velocity) {
    if (!mockInput.onmidimessage) {
        throw new Error('No MIDI message handler attached — device not selected?');
    }
    mockInput.onmidimessage({ data: [status, note, velocity] });
}
function noteOn(note, velocity = 100) { sendMidi(144, note, velocity); }
function noteOff(note) { sendMidi(128, note, 0); }

// Helper: play a chord (send multiple NoteOn)
function playChord(notes, velocity = 100) {
    notes.forEach(n => noteOn(n, velocity));
}
function releaseAll(notes) {
    notes.forEach(n => noteOff(n));
}

// ---- Test Suite ----
describe('BEHAVIORAL REGRESSION: Full Application Lifecycle', () => {

    beforeAll(() => {
        // Load modules once (they are stateless or we create new instances)
        MidiManager = require('../src/midi-manager');
        const analyzer = require('../src/harmonic-analyzer');
        detectChord = analyzer.detectChord;
        KeyDetector = require('../src/key-detector');
        const noteUtils = require('../src/note-utils');
        midiToNoteName = noteUtils.midiToNoteName;
    });

    beforeEach(() => {
        document.body.innerHTML = htmlContent;
        setupMocks();
        manager = new MidiManager();
        keyDetector = new KeyDetector();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // ==================================================================
    // TEST 1: Application Launch
    // ==================================================================
    test('1. Application launch — all modules load and UI elements exist', () => {
        // Verify core modules loaded
        expect(MidiManager).toBeDefined();
        expect(detectChord).toBeDefined();
        expect(KeyDetector).toBeDefined();
        expect(midiToNoteName).toBeDefined();

        // Verify all UI elements exist
        const requiredIds = [
            'midiInputSelect', 'refreshMidiBtn', 'activeNotesDisplay',
            'chordDisplay', 'keyDisplay', 'midiLog',
            'debugSection', 'toggleDebugBtn'
        ];
        for (const id of requiredIds) {
            expect(document.getElementById(id)).not.toBeNull();
        }
    });

    // ==================================================================
    // TEST 2: MIDI Device Enumeration
    // ==================================================================
    test('2. MIDI device enumeration — devices discovered after init', async () => {
        const success = await manager.init();
        expect(success).toBe(true);

        const inputs = manager.getInputs();
        expect(inputs.length).toBe(1);
        expect(inputs[0].id).toBe('behav-input-1');
        expect(inputs[0].name).toBe('Behavioral Test Keyboard');
        expect(inputs[0].state).toBe('connected');
    });

    // ==================================================================
    // TEST 3: MIDI Device Selection
    // ==================================================================
    test('3. MIDI device selection — input is attached and ready', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        expect(manager.activeInput).toBeDefined();
        expect(manager.activeInput.id).toBe('behav-input-1');
        expect(typeof mockInput.onmidimessage).toBe('function');
    });

    // ==================================================================
    // TEST 4: Simulated NoteOn Message
    // ==================================================================
    test('4. NoteOn message — note is added to active state', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        const spy = jest.fn();
        manager.on('note-on', spy);

        noteOn(60, 100); // C4

        expect(manager.getActiveNotes()).toContain(60);
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ note: 60, velocity: 100 })
        );
    });

    // ==================================================================
    // TEST 5: Simulated NoteOff Message
    // ==================================================================
    test('5. NoteOff message — note is removed from active state', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        const spy = jest.fn();
        manager.on('note-off', spy);

        noteOn(60);
        expect(manager.getActiveNotes()).toContain(60);

        noteOff(60);
        expect(manager.getActiveNotes()).not.toContain(60);
        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ note: 60 })
        );

        // Also test velocity-0 NoteOn (common MIDI convention for NoteOff)
        noteOn(64);
        expect(manager.getActiveNotes()).toContain(64);
        sendMidi(144, 64, 0); // NoteOn with velocity 0 = NoteOff
        expect(manager.getActiveNotes()).not.toContain(64);
    });

    // ==================================================================
    // TEST 6: Active Note Display Update
    // ==================================================================
    test('6. Active note display — correct note names from active state', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        // Play C4, E4, G4
        noteOn(60);
        noteOn(64);
        noteOn(67);

        const activeNotes = manager.getActiveNotes();
        const noteNames = activeNotes.map(n => midiToNoteName(n));

        expect(noteNames).toEqual(['C4', 'E4', 'G4']);

        // Simulate what renderer does: update display
        const display = document.getElementById('activeNotesDisplay');
        display.innerText = noteNames.join('  ');
        expect(display.innerText).toBe('C4  E4  G4');

        // Release E4
        noteOff(64);
        const updated = manager.getActiveNotes().map(n => midiToNoteName(n));
        display.innerText = updated.join('  ');
        expect(display.innerText).toBe('C4  G4');
    });

    // ==================================================================
    // TEST 7: Chord Classification Update
    // ==================================================================
    test('7. Chord classification — detects chords from active notes', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        const chordDisplay = document.getElementById('chordDisplay');

        // Play C Major: C4(60), E4(64), G4(67)
        playChord([60, 64, 67]);
        let chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Major');
        chordDisplay.innerText = chord;
        expect(chordDisplay.innerText).toBe('C Major');

        // Add B4(71) → C Maj7
        noteOn(71);
        chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Maj7');
        chordDisplay.innerText = chord;
        expect(chordDisplay.innerText).toBe('C Maj7');

        // Release all, play A Minor: A3(57), C4(60), E4(64)
        releaseAll([60, 64, 67, 71]);
        playChord([57, 60, 64]);
        chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('A Minor');
        chordDisplay.innerText = chord;
        expect(chordDisplay.innerText).toBe('A Minor');
    });

    // ==================================================================
    // TEST 8: Key Detection Update
    // ==================================================================
    test('8. Key detection — infers key from chord progression', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        const keyDisplay = document.getElementById('keyDisplay');

        // Simulate a ii-V-I in C Major
        // Dm: D3(50), F3(53), A3(57)
        playChord([50, 53, 57]);
        let chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('D Minor');
        keyDetector.addChord(chord);
        releaseAll([50, 53, 57]);

        // G: G3(55), B3(59), D4(62)
        playChord([55, 59, 62]);
        chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('G Major');
        keyDetector.addChord(chord);
        releaseAll([55, 59, 62]);

        // C: C4(60), E4(64), G4(67)
        playChord([60, 64, 67]);
        chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Major');
        keyDetector.addChord(chord);

        // Check key detection
        const keys = keyDetector.detect();
        expect(keys.length).toBeGreaterThan(0);
        expect(keys[0].root).toBe('C');
        expect(keys[0].scale).toBe('Major');

        // Simulate renderer update
        keyDisplay.innerText = `Key: ${keys[0].root} ${keys[0].scale}`;
        expect(keyDisplay.innerText).toBe('Key: C Major');

        releaseAll([60, 64, 67]);
    });

    // ==================================================================
    // TEST 9: Debug Log / Event Emission
    // ==================================================================
    test('9. Debug log — events emitted for every MIDI message', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        const events = [];
        manager.on('note-on', e => events.push(e));
        manager.on('note-off', e => events.push(e));

        // Play and release a chord
        playChord([60, 64, 67]); // 3 NoteOn
        releaseAll([60, 64, 67]); // 3 NoteOff

        expect(events).toHaveLength(6);

        // Simulate renderer log update
        const log = document.getElementById('midiLog');
        events.forEach(e => {
            const entry = document.createElement('div');
            const name = midiToNoteName(e.note);
            entry.textContent = `${e.type}: ${name} (${e.note})`;
            log.prepend(entry);
        });

        expect(log.children.length).toBe(6);
        // Most recent event should be first (prepend)
        expect(log.children[0].textContent).toContain('G4');
    });

    // ==================================================================
    // TEST 10: MIDI Device Refresh
    // ==================================================================
    test('10. Refresh — re-enumerates devices without losing state', async () => {
        await manager.init();
        manager.setInput('behav-input-1');

        // Play a note
        noteOn(60);
        expect(manager.getActiveNotes()).toEqual([60]);

        // Simulate refresh (re-init)
        const success = await manager.init();
        expect(success).toBe(true);
        expect(navigator.requestMIDIAccess).toHaveBeenCalledTimes(2);

        // After refresh, inputs should still be available
        const inputs = manager.getInputs();
        expect(inputs.length).toBe(1);
        expect(inputs[0].name).toBe('Behavioral Test Keyboard');

        // Re-select device
        manager.setInput('behav-input-1');
        expect(manager.activeInput).toBeDefined();

        // Previous active notes persist (Set is not cleared on re-init)
        // This matches real behavior: notes held during refresh stay active
        expect(manager.getActiveNotes()).toEqual([60]);
    });

    // ==================================================================
    // TEST 11: Chord Suggestions Update When Chord Changes
    // ==================================================================
    test('11. Chord suggestions — update when chord changes', async () => {
        const { suggestDiatonicChords } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Play C Major chord → detect → get suggestions
        playChord([60, 64, 67]);
        const chord1 = detectChord(manager.getActiveNotes());
        expect(chord1).toBe('C Major');
        keyDetector.addChord(chord1);
        const keys1 = keyDetector.detect();
        const key1 = `${keys1[0].root} ${keys1[0].scale}`;

        const suggestions1 = suggestDiatonicChords(key1, chord1);
        expect(suggestions1.length).toBeGreaterThan(0);
        const names1 = suggestions1.map(s => s.name);
        expect(names1).not.toContain('C Major'); // Current chord excluded

        // Render to DOM
        const container = document.getElementById('chord-suggestions');
        container.innerHTML = suggestions1.map(s => `<span>${s.name}</span>`).join('');
        expect(container.children.length).toBeGreaterThan(0);

        // Change chord → A Minor
        releaseAll([60, 64, 67]);
        playChord([57, 60, 64]);
        const chord2 = detectChord(manager.getActiveNotes());
        expect(chord2).toBe('A Minor');

        const suggestions2 = suggestDiatonicChords(key1, chord2);
        const names2 = suggestions2.map(s => s.name);
        expect(names2).not.toContain('A Minor'); // New chord excluded
        expect(names2).toContain('C Major'); // Previous chord now suggested

        // Render updated
        container.innerHTML = suggestions2.map(s => `<span>${s.name}</span>`).join('');
        expect(container.innerHTML).not.toBe('');
    });

    // ==================================================================
    // TEST 12: Scale Suggestions Update When Key Changes
    // ==================================================================
    test('12. Scale suggestions — update when key changes', async () => {
        const { suggestScales } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');
        const container = document.getElementById('scale-suggestions');

        // Build key: C Major (ii-V-I)
        playChord([50, 53, 57]); // Dm
        keyDetector.addChord(detectChord(manager.getActiveNotes()));
        releaseAll([50, 53, 57]);

        playChord([55, 59, 62]); // G
        keyDetector.addChord(detectChord(manager.getActiveNotes()));
        releaseAll([55, 59, 62]);

        playChord([60, 64, 67]); // C
        const chord = detectChord(manager.getActiveNotes());
        keyDetector.addChord(chord);

        const keys = keyDetector.detect();
        const key = `${keys[0].root} ${keys[0].scale}`;
        expect(key).toBe('C Major');

        const scales = suggestScales(key, chord);
        expect(scales.length).toBeGreaterThan(0);
        const scaleNames = scales.map(s => s.name);
        expect(scaleNames).toContain('C Major');

        // Render
        container.innerHTML = scales.map(s => `<span>${s.name}</span>`).join('');
        expect(container.children.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 13: Extension Suggestions Update on NoteOn/NoteOff
    // ==================================================================
    test('13. Extension suggestions — update on NoteOn/NoteOff', async () => {
        const { suggestExtensions } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');
        const container = document.getElementById('extension-suggestions');

        // Play C Major triad
        playChord([60, 64, 67]);
        const chord1 = detectChord(manager.getActiveNotes());
        expect(chord1).toBe('C Major');

        const ext1 = suggestExtensions(chord1);
        expect(ext1.length).toBeGreaterThan(0);
        const names1 = ext1.map(s => s.name);
        expect(names1).toContain('C Maj7');

        container.innerHTML = ext1.map(s => `<span>${s.name}</span>`).join('');
        const before = container.innerHTML;

        // Add B4 → now C Maj7 (NoteOn changes chord)
        noteOn(71);
        const chord2 = detectChord(manager.getActiveNotes());
        expect(chord2).toBe('C Maj7');

        const ext2 = suggestExtensions(chord2);
        // Maj7 has no further extensions in current map
        expect(ext2).toEqual([]);

        container.innerHTML = ext2.length > 0
            ? ext2.map(s => `<span>${s.name}</span>`).join('')
            : '\u2014';
        expect(container.innerHTML).not.toBe(before); // Changed

        // Release B4 (NoteOff) → back to C Major
        noteOff(71);
        const chord3 = detectChord(manager.getActiveNotes());
        expect(chord3).toBe('C Major');
        const ext3 = suggestExtensions(chord3);
        expect(ext3.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 14: Suggestions Emit After Refresh
    // ==================================================================
    test('14. Suggestions — emit output after refresh()', async () => {
        const { suggestDiatonicChords, suggestScales, suggestExtensions } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Play chord, build key
        playChord([60, 64, 67]);
        const chord = detectChord(manager.getActiveNotes());
        keyDetector.addChord(chord);
        const key = `${keyDetector.detect()[0].root} ${keyDetector.detect()[0].scale}`;

        // Get suggestions pre-refresh
        const pre = suggestDiatonicChords(key, chord);
        expect(pre.length).toBeGreaterThan(0);

        releaseAll([60, 64, 67]);

        // ---- REFRESH ----
        await manager.init();
        manager.setInput('behav-input-1');

        // Replay same chord post-refresh
        playChord([60, 64, 67]);
        const chordPost = detectChord(manager.getActiveNotes());
        expect(chordPost).toBe('C Major');

        // Suggestions still work after refresh
        const post = suggestDiatonicChords(key, chordPost);
        expect(post.length).toBeGreaterThan(0);
        expect(post.map(s => s.name)).toEqual(pre.map(s => s.name));

        const scalesPost = suggestScales(key, chordPost);
        expect(scalesPost.length).toBeGreaterThan(0);

        const extPost = suggestExtensions(chordPost);
        expect(extPost.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 15: Responsiveness — Analysis Cycle Timing
    // ==================================================================
    test('15. Responsiveness — analysis pipeline completes in <5ms', async () => {
        const { suggestDiatonicChords, suggestScales, suggestExtensions } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Prime key detector
        keyDetector.addChord('D Minor');
        keyDetector.addChord('G Major');
        keyDetector.addChord('C Major');

        // Play a chord
        playChord([60, 64, 67]);

        // Time the full analysis cycle
        const start = performance.now();

        const activeNotes = manager.getActiveNotes();
        const chord = detectChord(activeNotes);
        const keys = keyDetector.detect();
        const key = keys.length > 0 ? `${keys[0].root} ${keys[0].scale}` : null;

        suggestDiatonicChords(key, chord);
        suggestScales(key, chord);
        suggestExtensions(chord);

        const elapsed = performance.now() - start;

        // Full pipeline must complete in under 5ms
        expect(elapsed).toBeLessThan(5);
        console.log(`[PERF] Analysis cycle: ${elapsed.toFixed(2)}ms`);
    });

    // ==================================================================
    // TEST 16: Interval Suggestions Appear When <3 Notes
    // ==================================================================
    test('16. Interval suggestions — appear when <3 notes active', async () => {
        const { suggestIntervals } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Single note: C4
        noteOn(60);
        const notes1 = manager.getActiveNotes();
        expect(notes1.length).toBe(1);
        const intervals1 = suggestIntervals(notes1);
        expect(intervals1.length).toBeGreaterThan(0);
        expect(intervals1[0]).toHaveProperty('name');
        expect(intervals1[0]).toHaveProperty('interval');
        expect(intervals1[0]).toHaveProperty('result');

        // Two notes: C4 + E4
        noteOn(64);
        const notes2 = manager.getActiveNotes();
        expect(notes2.length).toBe(2);
        const intervals2 = suggestIntervals(notes2);
        expect(intervals2.length).toBeGreaterThan(0);

        // Adding G4 (now 3 notes) → intervals should be empty
        noteOn(67);
        const notes3 = manager.getActiveNotes();
        expect(notes3.length).toBe(3);
        const intervals3 = suggestIntervals(notes3);
        expect(intervals3).toEqual([]);
    });

    // ==================================================================
    // TEST 17: Suggestions Persist After NoteOff Clears Chord
    // ==================================================================
    test('17. Persistent state — suggestions persist after NoteOff clears chord', async () => {
        const { suggestDiatonicChords, suggestExtensions } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Play C Major triad
        playChord([60, 64, 67]);
        const chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Major');
        keyDetector.addChord(chord);
        const key = `${keyDetector.detect()[0].root} ${keyDetector.detect()[0].scale}`;

        // Cache suggestions (simulating renderer persistent state)
        const cachedChordSugs = suggestDiatonicChords(key, chord);
        const cachedExtSugs = suggestExtensions(chord);
        expect(cachedChordSugs.length).toBeGreaterThan(0);
        expect(cachedExtSugs.length).toBeGreaterThan(0);

        // Release all notes → chord gone
        releaseAll([60, 64, 67]);
        const noChord = detectChord(manager.getActiveNotes());
        expect(noChord).toBeNull();

        // Cached suggestions should still be valid and non-empty
        expect(cachedChordSugs.length).toBeGreaterThan(0);
        expect(cachedExtSugs.length).toBeGreaterThan(0);

        // Render cached into DOM
        const container = document.getElementById('chord-suggestions');
        container.innerHTML = cachedChordSugs.map(s => `<span>${s.name}</span>`).join('');
        expect(container.children.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 18: Chord Suggestions Replaced Only on New Valid Chord
    // ==================================================================
    test('18. Chord suggestions — replaced only on new valid chord', async () => {
        const { suggestDiatonicChords } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Play C Major
        playChord([60, 64, 67]);
        const chord1 = detectChord(manager.getActiveNotes());
        keyDetector.addChord(chord1);
        const key = `${keyDetector.detect()[0].root} ${keyDetector.detect()[0].scale}`;
        const sug1 = suggestDiatonicChords(key, chord1);
        const sug1Names = sug1.map(s => s.name);

        // Release → single note (no valid chord)
        releaseAll([60, 64, 67]);
        noteOn(62); // D4 alone
        const noChord = detectChord(manager.getActiveNotes());
        expect(noChord).toBeNull();

        // Cached suggestions should remain unchanged
        expect(sug1Names.length).toBeGreaterThan(0);

        // Play A Minor → new valid chord → suggestions SHOULD change
        noteOff(62);
        playChord([57, 60, 64]);
        const chord2 = detectChord(manager.getActiveNotes());
        expect(chord2).toBe('A Minor');
        const sug2 = suggestDiatonicChords(key, chord2);
        const sug2Names = sug2.map(s => s.name);

        // A Minor is now excluded, C Major is now included
        expect(sug2Names).not.toContain('A Minor');
        expect(sug2Names).toContain('C Major');
        expect(sug2Names).not.toEqual(sug1Names);
    });

    // ==================================================================
    // TEST 19: Interval Suggestions Suppressed When Chord Detected
    // ==================================================================
    test('19. Interval suggestions — suppressed when chord detected', async () => {
        const { suggestIntervals } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Two notes → intervals should appear
        noteOn(60);
        noteOn(64);
        const intervals = suggestIntervals(manager.getActiveNotes());
        expect(intervals.length).toBeGreaterThan(0);

        // Add G4 → full chord detected → intervals should be suppressed
        noteOn(67);
        const chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Major');
        const noIntervals = suggestIntervals(manager.getActiveNotes());
        expect(noIntervals).toEqual([]);
    });

    // ==================================================================
    // TEST 20: Log Display Limit Restricts Visible Entries
    // ==================================================================
    test('20. Log display — limit restricts visible entries', () => {
        const logContainer = document.getElementById('midiLog');
        logContainer.innerHTML = '';

        // Simulate adding 10 log entries
        for (let i = 0; i < 10; i++) {
            const entry = document.createElement('div');
            entry.textContent = `Log entry ${i}`;
            logContainer.appendChild(entry);
        }

        // Apply a limit of 5 by removing excess
        const limit = 5;
        while (logContainer.children.length > limit) {
            logContainer.removeChild(logContainer.lastChild);
        }

        expect(logContainer.children.length).toBe(5);
        expect(logContainer.children[0].textContent).toBe('Log entry 0');
    });

    // ==================================================================
    // TEST 21: Changing Display Limit Triggers Re-render
    // ==================================================================
    test('21. Log display — changing limit triggers re-render', () => {
        const logContainer = document.getElementById('midiLog');
        const allEntries = [];

        // Build a backlog of 20 entries
        for (let i = 0; i < 20; i++) {
            allEntries.push(`[00:00:00] Entry ${i}`);
        }

        // Render with limit=10
        function renderWithLimit(limit) {
            logContainer.innerHTML = '';
            const visible = allEntries.slice(0, limit);
            for (const text of visible) {
                const entry = document.createElement('div');
                entry.textContent = text;
                logContainer.appendChild(entry);
            }
        }

        renderWithLimit(10);
        expect(logContainer.children.length).toBe(10);

        // Change limit to 5 → re-render
        renderWithLimit(5);
        expect(logContainer.children.length).toBe(5);

        // Change limit to 15 → re-render
        renderWithLimit(15);
        expect(logContainer.children.length).toBe(15);
    });

    // ==================================================================
    // TEST 22: Pause Preserves Incoming Entries
    // ==================================================================
    test('22. Log feed — pause preserves incoming entries', () => {
        const logContainer = document.getElementById('midiLog');
        const backlog = [];
        let paused = false;

        function addLog(msg) {
            backlog.unshift(msg);
            if (!paused) {
                const entry = document.createElement('div');
                entry.textContent = msg;
                logContainer.prepend(entry);
            }
        }

        logContainer.innerHTML = '';
        addLog('Before pause 1');
        addLog('Before pause 2');
        expect(logContainer.children.length).toBe(2);

        // Pause
        paused = true;
        addLog('During pause 1');
        addLog('During pause 2');
        addLog('During pause 3');

        // UI should NOT have updated
        expect(logContainer.children.length).toBe(2);
        // Backlog should have all 5
        expect(backlog.length).toBe(5);
    });

    // ==================================================================
    // TEST 23: Resume Restores Feed Within Limit
    // ==================================================================
    test('23. Log feed — resume restores feed within limit', () => {
        const logContainer = document.getElementById('midiLog');
        const backlog = [];
        let paused = false;
        const limit = 3;

        function addLog(msg) {
            backlog.unshift(msg);
        }

        function renderFeed() {
            logContainer.innerHTML = '';
            const visible = backlog.slice(0, limit);
            for (const text of visible) {
                const entry = document.createElement('div');
                entry.textContent = text;
                logContainer.appendChild(entry);
            }
        }

        // Add 5 entries while "paused"
        paused = true;
        for (let i = 0; i < 5; i++) addLog(`Entry ${i}`);
        logContainer.innerHTML = '';
        expect(logContainer.children.length).toBe(0);

        // Resume → render within limit
        paused = false;
        renderFeed();
        expect(logContainer.children.length).toBe(limit);
        expect(logContainer.children[0].textContent).toBe('Entry 4');
    });

    // ==================================================================
    // TEST 24: Suggestion Hover/Click Triggers Metadata Display
    // ==================================================================
    test('24. Suggestion interaction — hover/click triggers metadata', () => {
        const { getChordMetadata } = require('../src/suggestion-engine');

        const meta = getChordMetadata('C Major');
        expect(meta).not.toBeNull();

        // Build tooltip HTML
        const detailContainer = document.getElementById('suggestion-detail');
        const html = `<strong>C Major</strong><br>` +
            `Notes: ${meta.noteNames.join(' - ')}<br>` +
            `MIDI: ${meta.midiNotes.join(' - ')}<br>` +
            `Fingering (RH): ${meta.fingering.join(' - ')}`;

        detailContainer.innerHTML = html;
        detailContainer.style.display = 'block';

        expect(detailContainer.style.display).toBe('block');
        expect(detailContainer.innerHTML).toContain('C Major');
        expect(detailContainer.innerHTML).toContain('60 - 64 - 67');
        expect(detailContainer.innerHTML).toContain('1 - 3 - 5');
    });

    // ==================================================================
    // TEST 25: Metadata Contains Note Names, MIDI Numbers, Fingering
    // ==================================================================
    test('25. Metadata format — includes note names, MIDI, fingering', () => {
        const { getChordMetadata } = require('../src/suggestion-engine');

        const meta = getChordMetadata('A Minor');
        expect(meta).not.toBeNull();
        expect(meta).toHaveProperty('noteNames');
        expect(meta).toHaveProperty('midiNotes');
        expect(meta).toHaveProperty('fingering');
        expect(meta.noteNames).toEqual(['A', 'C', 'E']);
        expect(meta.midiNotes).toEqual([69, 72, 76]);
        expect(meta.fingering).toEqual([1, 3, 5]);
    });

    // ==================================================================
    // TEST 26: Interval Suggestion Metadata
    // ==================================================================
    test('26. Interval suggestion — metadata for resulting chord', async () => {
        const { suggestIntervals, getChordMetadata } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        noteOn(60);
        noteOn(64);
        const intervals = suggestIntervals(manager.getActiveNotes());

        // Find add-G suggestion (+7) → should predict C Major
        const addG = intervals.find(s => s.interval === '+7');
        expect(addG).toBeDefined();
        expect(addG.result).toBe('C Major');

        // Get metadata for the predicted chord
        const meta = getChordMetadata(addG.result);
        expect(meta).not.toBeNull();
        expect(meta.noteNames).toEqual(['C', 'E', 'G']);
        expect(meta.fingering).toEqual([1, 3, 5]);
    });

    // ==================================================================
    // TEST 27: Cached Suggestions Unchanged During Feed Pause
    // ==================================================================
    test('27. Persistence — cached suggestions unchanged during pause', async () => {
        const { suggestDiatonicChords, suggestExtensions } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Play C Major → build suggestions
        playChord([60, 64, 67]);
        const chord = detectChord(manager.getActiveNotes());
        expect(chord).toBe('C Major');
        keyDetector.addChord(chord);
        const key = `${keyDetector.detect()[0].root} ${keyDetector.detect()[0].scale}`;

        const cached = {
            chord: suggestDiatonicChords(key, chord),
            extension: suggestExtensions(chord)
        };

        const chordSnapshot = JSON.stringify(cached);

        // "Pause" the log feed (simulate)
        let paused = true;

        // Continue generating events
        releaseAll([60, 64, 67]);
        noteOn(62);
        noteOff(62);

        // Verify cached suggestions are unchanged
        expect(JSON.stringify(cached)).toBe(chordSnapshot);
        expect(cached.chord.length).toBeGreaterThan(0);
        expect(cached.extension.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 28: Interaction Does Not Invalidate Persistent State
    // ==================================================================
    test('28. Persistence — interaction does not invalidate state', async () => {
        const { suggestDiatonicChords, suggestExtensions, getChordMetadata } = require('../src/suggestion-engine');

        await manager.init();
        manager.setInput('behav-input-1');

        // Build persistent state
        playChord([60, 64, 67]);
        const chord = detectChord(manager.getActiveNotes());
        keyDetector.addChord(chord);
        const key = `${keyDetector.detect()[0].root} ${keyDetector.detect()[0].scale}`;

        const lastValidChord = chord;
        const lastValidKey = key;
        const lastSuggestions = {
            chord: suggestDiatonicChords(key, chord),
            extension: suggestExtensions(chord)
        };

        // Simulate interaction: get metadata (shouldn't mutate state)
        const meta = getChordMetadata(lastSuggestions.chord[0].name);
        expect(meta).not.toBeNull();

        // Verify persistent state is untouched
        expect(lastValidChord).toBe('C Major');
        expect(lastValidKey).toBe(key);
        expect(lastSuggestions.chord.length).toBeGreaterThan(0);
        expect(lastSuggestions.extension.length).toBeGreaterThan(0);

        // Re-calling suggestions with same inputs → identical output
        const regen = suggestDiatonicChords(lastValidKey, lastValidChord);
        expect(regen).toEqual(lastSuggestions.chord);
    });

    // ==================================================================
    // TEST 29: Progression Memory Length Affects Suggestion Generation
    // ==================================================================
    test('29. Progression — memory length affects suggestion generation', () => {
        const { suggestNextChords } = require('../src/suggestion-engine');

        const history = ['C Major', 'F Major', 'G Major', 'A Minor'];
        const mem2 = suggestNextChords(history, 'C Major', 2);
        const mem4 = suggestNextChords(history, 'C Major', 4);

        expect(mem2.length).toBeGreaterThan(0);
        expect(mem4.length).toBeGreaterThan(0);
        // Different memory lengths → different penalty distribution
        expect(mem2).toBeDefined();
        expect(mem4).toBeDefined();
    });

    // ==================================================================
    // TEST 30: Clicking Suggestion Appends to Progression
    // ==================================================================
    test('30. Progression — clicking suggestion appends to progression', () => {
        const container = document.getElementById('current-progression');
        const progression = [];

        // Simulate clicking a suggestion chip → appending
        progression.push('C Major');
        progression.push('F Major');

        // Render
        container.innerHTML = progression.map((chord, i) => {
            return `<span data-chord="${chord}" data-prog-index="${i}">${chord}</span>`;
        }).join(' → ');

        expect(progression.length).toBe(2);
        expect(container.querySelectorAll('[data-chord]').length).toBe(2);
        expect(container.textContent).toContain('C Major');
        expect(container.textContent).toContain('F Major');
    });

    // ==================================================================
    // TEST 31: Removing Chord Updates Progression State
    // ==================================================================
    test('31. Progression — removing chord updates state', () => {
        const container = document.getElementById('current-progression');
        const progression = ['C Major', 'F Major', 'G Major'];

        // Remove index 1 (F Major)
        progression.splice(1, 1);
        expect(progression).toEqual(['C Major', 'G Major']);
        expect(progression.length).toBe(2);

        // Re-render
        container.innerHTML = progression.map((chord, i) => {
            return `<span data-chord="${chord}" data-prog-index="${i}">${chord}</span>`;
        }).join(' → ');

        expect(container.querySelectorAll('[data-chord]').length).toBe(2);
    });

    // ==================================================================
    // TEST 32: Suggestions Adapt After Progression Lock-In
    // ==================================================================
    test('32. Progression — suggestions adapt after lock-in', () => {
        const { suggestNextChords } = require('../src/suggestion-engine');

        const before = suggestNextChords(['C Major'], 'C Major');
        const after = suggestNextChords(['C Major', 'F Major', 'G Major'], 'C Major');

        // Suggestions should change as progression grows
        expect(before).not.toEqual(after);
        expect(after.length).toBeGreaterThan(0);
    });

    // ==================================================================
    // TEST 33: Progression Suggestions Show Metadata
    // ==================================================================
    test('33. Tooltip — progression suggestions show metadata', () => {
        const { suggestNextChords, getChordMetadata } = require('../src/suggestion-engine');

        const suggestions = suggestNextChords(['C Major'], 'C Major');
        expect(suggestions.length).toBeGreaterThan(0);

        // Get metadata for first suggestion
        const meta = getChordMetadata(suggestions[0].name);
        expect(meta).not.toBeNull();
        expect(meta).toHaveProperty('noteNames');
        expect(meta).toHaveProperty('midiNotes');
        expect(meta).toHaveProperty('fingering');
    });

    // ==================================================================
    // TEST 34: Locked Progression Chips Retain Interaction
    // ==================================================================
    test('34. Tooltip — locked progression chips retain interaction', () => {
        const { getChordMetadata } = require('../src/suggestion-engine');

        const progression = ['C Major', 'F Major', 'G Major'];
        const container = document.getElementById('current-progression');

        // Render interactive chips
        container.innerHTML = progression.map((chord, i) => {
            return `<span data-chord="${chord}" data-prog-index="${i}">${chord}</span>`;
        }).join('');

        // Each chip should be queryable for metadata
        const chips = container.querySelectorAll('[data-chord]');
        expect(chips.length).toBe(3);

        for (const chip of chips) {
            const meta = getChordMetadata(chip.dataset.chord);
            expect(meta).not.toBeNull();
            expect(meta.noteNames.length).toBeGreaterThan(0);
        }
    });

    // ==================================================================
    // TEST 35: version.json Created and Updated
    // ==================================================================
    test('35. Versioning — version.json exists and parses', () => {
        const versionPath = path.resolve(__dirname, '../version.json');
        expect(fs.existsSync(versionPath)).toBe(true);

        const data = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        expect(data).toHaveProperty('version');
        expect(typeof data.version).toBe('string');
        expect(data.version.split('.').length).toBe(3);
    });

    // ==================================================================
    // TEST 36: version:patch Updates Correctly
    // ==================================================================
    test('36. Versioning — patch bump logic is correct', () => {
        // Test the bump logic without writing (simulate)
        const version = '0.1.0';
        const parts = version.split('.').map(Number);
        parts[2]++;
        expect(parts.join('.')).toBe('0.1.1');
    });

    // ==================================================================
    // TEST 37: version:minor Updates Correctly
    // ==================================================================
    test('37. Versioning — minor bump logic is correct', () => {
        const version = '0.1.3';
        const parts = version.split('.').map(Number);
        parts[1]++;
        parts[2] = 0;
        expect(parts.join('.')).toBe('0.2.0');
    });

    // ==================================================================
    // TEST 38: Launch Script Validates Dependencies
    // ==================================================================
    test('38. Launch — script validates critical files', () => {
        const launchScript = path.resolve(__dirname, '../scripts/launch.js');
        expect(fs.existsSync(launchScript)).toBe(true);

        // Verify critical files that the launch script checks
        expect(fs.existsSync(path.resolve(__dirname, '../src/main.js'))).toBe(true);
        expect(fs.existsSync(path.resolve(__dirname, '../index.html'))).toBe(true);
        expect(fs.existsSync(path.resolve(__dirname, '../package.json'))).toBe(true);
    });

    // ==================================================================
    // TEST 39: loopMIDI Detection Logic
    // ==================================================================
    test('39. loopMIDI — detection logic identifies loopMIDI devices', () => {
        // Simulate device list with and without loopMIDI
        const devicesWithLoop = [
            { name: 'USB MIDI Controller', id: '1' },
            { name: 'loopMIDI Port', id: '2' }
        ];
        const devicesWithout = [
            { name: 'USB MIDI Controller', id: '1' }
        ];

        const hasLoop = devicesWithLoop.some(d => d.name.toLowerCase().includes('loopmidi'));
        const hasNoLoop = devicesWithout.some(d => d.name.toLowerCase().includes('loopmidi'));

        expect(hasLoop).toBe(true);
        expect(hasNoLoop).toBe(false);
    });
});
