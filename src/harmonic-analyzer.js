const { getChordName } = require('./chord-dictionary');

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Detects the chord from a set of MIDI note numbers.
 * @param {number[]} activeNotes - Array of MIDI note numbers.
 * @returns {string|null} The detected chord name (e.g., "C Major") or null.
 */
function detectChord(activeNotes) {
    if (!activeNotes || activeNotes.length < 3) return null; // Need at least 3 notes

    // 1. Get unique Pitch Classes (0-11) sorted
    const pitchClasses = [...new Set(activeNotes.map(n => n % 12))].sort((a, b) => a - b);

    // 2. Try every pitch class as the Root
    for (let i = 0; i < pitchClasses.length; i++) {
        const root = pitchClasses[i];

        // 3. Calculate intervals relative to this root
        // We normalize everything to 0-based intervals from the root
        const intervals = pitchClasses.map(pc => {
            let interval = pc - root;
            if (interval < 0) interval += 12;
            return interval;
        }).sort((a, b) => a - b);

        // 4. Check Dictionary
        const chordQuality = getChordName(intervals);
        if (chordQuality) {
            const rootName = NOTE_NAMES[root];
            return `${rootName} ${chordQuality}`;
        }
    }

    return null; // No match found
}

module.exports = { detectChord };
