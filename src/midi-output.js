const { getChordMetadata } = require('./suggestion-engine');

let midiAccess = null;
let activeOutput = null;
let isPlaying = false;
let activeTimeouts = [];

/**
 * Initialize MIDI Access (Sysex false)
 * @returns {Promise<boolean>} success
 */
async function initMidiOutput() {
    try {
        if (!navigator.requestMIDIAccess) return false;
        midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        console.log('[MidiOutput] MIDI Access initialized');
        return true;
    } catch (e) {
        console.error('[MidiOutput] Failed to init MIDI', e);
        return false;
    }
}

/**
 * Get available output ports
 * @returns {Array<MidiOutput>}
 */
function getOutputs() {
    if (!midiAccess) return [];
    return Array.from(midiAccess.outputs.values());
}

/**
 * Set the active output device
 * @param {string} id 
 */
function setOutput(id) {
    if (!midiAccess) return;
    const output = midiAccess.outputs.get(id);
    if (output) {
        activeOutput = output;
        console.log(`[MidiOutput] Output set to: ${output.name}`);
    } else {
        console.warn(`[MidiOutput] Output ${id} not found`);
    }
}

/**
 * Play a progression of chord names
 * @param {Array<string>} progression ["C Major", "G Major", ...]
 * @param {number} bpm Beats per minute (60-200)
 * @param {number} beatsPerChord Duration in beats
 * @param {string} register "Mid", "Bass", etc (affects octave)
 * @param {Function} onComplete Callback when done
 */
function playProgression(progression, bpm, beatsPerChord, register, onComplete) {
    if (isPlaying) stopPlayback();
    if (!activeOutput || !progression || progression.length === 0) return;

    isPlaying = true;

    // Timing calculation
    const beatMs = 60000 / bpm;
    const chordDurationMs = beatsPerChord * beatMs;
    // Overlap/Legato: NoteOff exactly at end of duration
    // Stagger: 5ms between notes in a chord

    let currentTime = 0;

    progression.forEach((chordName, index) => {
        // Map register to octave
        let baseOctave = 4;
        if (register === 'Sub') baseOctave = 1;
        else if (register === 'Bass') baseOctave = 2;
        else if (register === 'Mid') baseOctave = 3;
        else if (register === 'Harmony') baseOctave = 5;

        // Use engine to calculate notes
        const metadata = getChordMetadata(chordName, baseOctave);
        if (!metadata || !metadata.midiNotes) return;

        const notes = metadata.midiNotes;

        // Schedule NoteOn
        notes.forEach((note, noteIndex) => {
            const stagger = noteIndex * 5; // 5ms stagger
            const onTime = currentTime + stagger;
            const offTime = currentTime + chordDurationMs; // sustain full duration

            // Note On
            const timerOn = setTimeout(() => {
                if (activeOutput) {
                    // Send Note On (0x90) on Channel 1, with velocity 96
                    activeOutput.send([0x90, note, 96]);
                }
            }, onTime);

            // Note Off
            const timerOff = setTimeout(() => {
                if (activeOutput) {
                    // Send Note Off (0x80) on Channel 1 with release velocity 64
                    activeOutput.send([0x80, note, 64]);
                }
            }, offTime);

            activeTimeouts.push(timerOn, timerOff);
        });

        currentTime += chordDurationMs;
    });

    // Schedule completion
    const completeTimer = setTimeout(() => {
        isPlaying = false;
        activeTimeouts = [];
        if (onComplete) onComplete();
    }, currentTime + 100); // Buffer
    activeTimeouts.push(completeTimer);
}

/**
 * Stop playback and clear pending events
 */
function stopPlayback() {
    isPlaying = false;
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];

    // Panic: All Notes Off on active channel (or just waiting notes?)
    // Real-time: we can't easily undo sent notes unless we tracked them.
    // Ideally send All Notes Off (CC 123) or individual NoteOffs for currently playing.
    // For simplicity/robustness, send All Notes Off.
    if (activeOutput) {
        // Send CC 123 (All Notes Off) on Channel 1 (0xB0)
        activeOutput.send([0xB0, 123, 0]);
    }
}

/**
 * Play a single set of MIDI notes immediately
 * @param {Array<number>} notes 
 * @param {number} durationMs 
 */
function playChordVoicing(notes, durationMs) {
    if (!activeOutput || !notes || notes.length === 0) return;

    notes.forEach((note, index) => {
        const stagger = index * 5;

        // Note On
        setTimeout(() => {
            if (activeOutput) activeOutput.send([0x90, note, 96]);
        }, stagger);

        // Note Off
        setTimeout(() => {
            if (activeOutput) activeOutput.send([0x80, note, 64]);
        }, durationMs + stagger);
    });
}

/**
 * Stateless chord preview for UI interaction.
 * Bypasses progression state and uses standard velocity 64 for release.
 * @param {Array<number>} notes 
 */
function previewChordVoicing(notes) {
    if (!activeOutput || !notes || notes.length === 0) return;

    notes.forEach((note, index) => {
        const stagger = index * 2; // Tighter stagger for UI feedback

        // Note On
        setTimeout(() => {
            if (activeOutput) activeOutput.send([0x90, note, 80]); // Slightly softer for preview
        }, stagger);

        // Note Off
        setTimeout(() => {
            if (activeOutput) activeOutput.send([0x80, note, 64]);
        }, 400 + stagger); // Fixed short duration for preview
    });
}

module.exports = {
    initMidiOutput,
    getOutputs,
    setOutput,
    getOutputs,
    setOutput,
    playProgression,
    stopPlayback,
    playChordVoicing,
    previewChordVoicing
};
