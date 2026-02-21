const { CHORD_INTERVALS } = require('./chord-dictionary');
const SCALES = require('./scale-dictionary');
const { getNoteNumber } = require('./note-utils');

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

class KeyDetector {
    constructor() {
        this.recentChords = [];
        this.maxHistory = 10;
    }

    /**
     * @param {string} chordName - e.g. "C Major", "F# Min7"
     */
    addChord(chordName) {
        if (!chordName) return;

        // Parse chord parts: Root + Quality
        // Heuristic: Split by space
        const parts = chordName.split(' ');
        if (parts.length < 2) return;

        const rootName = parts[0];
        const qualityName = parts.slice(1).join(' '); // "Major", "Dom7", etc.

        const rootNote = getNoteNumber(rootName);
        if (rootNote === -1) return;

        // Find intervals for this quality
        // We need to reverse lookup in CHORD_INTERVALS or search entries
        // Since CHORD_INTERVALS keys are strings "0,4,7", we search values
        // This is inefficient but functional for small dictionary
        let intervals = null;
        for (const [key, val] of Object.entries(CHORD_INTERVALS)) {
            if (val === qualityName) {
                intervals = key.split(',').map(Number);
                break;
            }
        }

        if (!intervals) return;

        // Calculate absolute pitch classes
        const notes = intervals.map(interval => (rootNote + interval) % 12);

        this.recentChords.push({ notes, root: rootNote, timestamp: Date.now() });
        if (this.recentChords.length > this.maxHistory) {
            this.recentChords.shift();
        }
    }

    detect() {
        if (this.recentChords.length === 0) return [];

        const scores = [];

        // For each of 12 roots * 2 scales
        for (let root = 0; root < 12; root++) {
            for (const [scaleName, scaleIntervals] of Object.entries(SCALES)) {
                // Construct scale pitch classes
                const scaleNotes = new Set(scaleIntervals.map(i => (root + i) % 12));

                let score = 0;
                let totalNotes = 0;

                // Score against history
                for (const chord of this.recentChords) {
                    for (const note of chord.notes) {
                        totalNotes++;
                        if (scaleNotes.has(note)) {
                            score += 1;
                        }
                    }
                }

                const normalizedScore = totalNotes > 0 ? score / totalNotes : 0;

                // Weighting:
                // 1. Root Match: If the chord root equals the key root, likely the tonic. (+0.1)

                let finalScore = normalizedScore;

                // Bonus for matching roots of recent chords
                // If a chord root is the same as the key root, it suggests this key.
                const lastChord = this.recentChords[this.recentChords.length - 1];
                if (lastChord && lastChord.root === root) {
                    finalScore += 0.15;
                }

                scores.push({
                    root: NOTE_NAMES[root],
                    scale: scaleName,
                    score: finalScore
                });
            }
        }

        // Sort by score descending
        return scores.sort((a, b) => b.score - a.score).slice(0, 5); // Return top 5
    }

    reset() {
        this.recentChords = [];
    }
}

module.exports = KeyDetector;
