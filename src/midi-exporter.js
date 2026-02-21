/**
 * MIDI Exporter
 * =============
 * Pure function that generates a Standard MIDI File (SMF Type 0) from a chord progression.
 * Uses getChordMetadata() for note lookup. NO DOM access.
 */

const { getChordMetadata } = require('./suggestion-engine');

const TICKS_PER_BEAT = 480;

// Register → octave mapping
const REGISTER_MAP = {
    'Sub': 1,
    'Bass': 2,
    'Mid': 3,
    'Harmony': 4
};

/**
 * Build a voicing for a chord based on the selected style.
 *
 * @param {string} chordName - e.g. "C Major", "A Minor"
 * @param {string} style - "Root Only", "Root + 5th", "Root + 10th", "Triad"
 * @param {number} octave - Base octave (1-5)
 * @returns {number[]|null} - Array of MIDI note numbers, or null if invalid
 */
function buildVoicing(chordName, style, octave) {
    const meta = getChordMetadata(chordName, octave);
    if (!meta || !meta.midiNotes || meta.midiNotes.length === 0) return null;

    const root = meta.midiNotes[0];

    switch (style) {
        case 'Root Only':
            return [root];
        case 'Root + 5th':
            return [root, root + 7];
        case 'Root + 10th': {
            // Determine 10th: major chord → major 10th (+16), minor chord → minor 10th (+15)
            const isMinor = chordName.toLowerCase().includes('minor') ||
                chordName.toLowerCase().includes('min');
            const tenthInterval = isMinor ? 15 : 16;
            return [root, root + tenthInterval];
        }
        case 'Triad':
        default:
            return meta.midiNotes;
    }
}

/**
 * Write a variable-length quantity (VLQ) used in MIDI file format.
 * @param {number} value
 * @returns {number[]}
 */
function writeVLQ(value) {
    if (value < 0) value = 0;
    if (value <= 0x7F) return [value];

    const bytes = [];
    bytes.unshift(value & 0x7F);
    value >>= 7;
    while (value > 0) {
        bytes.unshift((value & 0x7F) | 0x80);
        value >>= 7;
    }
    return bytes;
}

/**
 * Write a 16-bit big-endian value.
 */
function writeUint16(value) {
    return [(value >> 8) & 0xFF, value & 0xFF];
}

/**
 * Write a 32-bit big-endian value.
 */
function writeUint32(value) {
    return [
        (value >> 24) & 0xFF,
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF
    ];
}

/**
 * Build a tempo meta event (FF 51 03 tt tt tt).
 * @param {number} bpm
 * @returns {number[]}
 */
function buildTempoEvent(bpm) {
    const microsecondsPerBeat = Math.round(60000000 / bpm);
    return [
        0x00,       // delta time
        0xFF, 0x51, 0x03,
        (microsecondsPerBeat >> 16) & 0xFF,
        (microsecondsPerBeat >> 8) & 0xFF,
        microsecondsPerBeat & 0xFF
    ];
}

/**
 * Build end-of-track meta event.
 * @returns {number[]}
 */
function buildEndOfTrack() {
    return [0x00, 0xFF, 0x2F, 0x00];
}

/**
 * Export a chord progression to a Standard MIDI File (Type 0).
 *
 * @param {string[]} progression - Array of chord names, e.g. ["C Major", "F Major", "G Major"]
 * @param {Object} options
 * @param {number} [options.bpm=120] - Tempo in beats per minute
 * @param {number} [options.beatsPerChord=2] - Duration of each chord in beats
 * @param {number} [options.velocity=100] - Note velocity (1-127)
 * @param {string} [options.register='Mid'] - Register preset (Sub/Bass/Mid/Harmony)
 * @param {number} [options.octave] - Direct octave override (fallback if register absent)
 * @param {string} [options.voicingStyle='Triad'] - Voicing style
 * @returns {Uint8Array} - Complete MIDI file as binary buffer
 */
function exportProgressionToMidi(progression, options = {}) {
    const {
        bpm = 120,
        beatsPerChord = 2,
        velocity = 100,
        register,
        octave,
        voicingStyle = 'Triad'
    } = options;

    // Resolve octave: register takes priority, then direct octave, then default 4
    const resolvedOctave = register && REGISTER_MAP[register] !== undefined
        ? REGISTER_MAP[register]
        : (octave !== undefined ? octave : 4);

    if (!Array.isArray(progression) || progression.length === 0) {
        return new Uint8Array(0);
    }

    const channel = 0; // MIDI channel 0
    const chordDuration = beatsPerChord * TICKS_PER_BEAT;

    // Build track data
    const trackData = [];

    // Tempo event
    trackData.push(...buildTempoEvent(bpm));

    // For each chord: NoteOn (delta=0 for simultaneous), then NoteOff after duration
    for (let i = 0; i < progression.length; i++) {
        const notes = buildVoicing(progression[i], voicingStyle, resolvedOctave);
        if (!notes || notes.length === 0) continue;

        // NoteOn events (delta=0 for all notes — simultaneous)
        for (let n = 0; n < notes.length; n++) {
            const delta = (n === 0 && i === 0) ? 0 : (n === 0 ? 0 : 0);
            trackData.push(...writeVLQ(delta));
            trackData.push(0x90 | channel); // NoteOn
            trackData.push(notes[n] & 0x7F);
            trackData.push(velocity & 0x7F);
        }

        // NoteOff events after chordDuration
        for (let n = 0; n < notes.length; n++) {
            const delta = (n === 0) ? chordDuration : 0;
            trackData.push(...writeVLQ(delta));
            trackData.push(0x80 | channel); // NoteOff
            trackData.push(notes[n] & 0x7F);
            trackData.push(0x00); // release velocity
        }
    }

    // End of track
    trackData.push(...buildEndOfTrack());

    // Build complete MIDI file
    const header = [
        // MThd
        0x4D, 0x54, 0x68, 0x64,    // "MThd"
        ...writeUint32(6),           // Header length = 6
        ...writeUint16(0),           // Format 0 (single track)
        ...writeUint16(1),           // 1 track
        ...writeUint16(TICKS_PER_BEAT) // Ticks per beat
    ];

    const trackHeader = [
        // MTrk
        0x4D, 0x54, 0x72, 0x6B,    // "MTrk"
        ...writeUint32(trackData.length)
    ];

    const file = new Uint8Array(header.length + trackHeader.length + trackData.length);
    file.set(header, 0);
    file.set(trackHeader, header.length);
    file.set(trackData, header.length + trackHeader.length);

    return file;
}

module.exports = { exportProgressionToMidi, buildVoicing, REGISTER_MAP, TICKS_PER_BEAT };
