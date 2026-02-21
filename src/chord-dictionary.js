/**
 * Chord Dictionary
 * Maps standardized interval sets (relative to root) to chord names.
 * Intervals are semitones: 0 = Root, 3 = Minor Third, 4 = Major Third, 7 = Perfect Fifth, etc.
 */

const CHORD_INTERVALS = {
    // Triads
    "0,4,7": "Major",
    "0,3,7": "Minor",
    "0,3,6": "Diminished",
    "0,4,8": "Augmented",
    "0,4,7,12": "Major", // Handle octave doubling
    "0,3,7,12": "Minor",

    // Sevenths
    "0,4,7,11": "Maj7",
    "0,4,7,10": "Dom7",
    "0,3,7,10": "Min7",
    "0,3,7,11": "MinMaj7",
    "0,3,6,10": "m7b5 (Half-Dim)",
    "0,3,6,9": "Dim7",

    // Suspended
    "0,5,7": "Sus4",
    "0,2,7": "Sus2",
    "0,5,7,10": "7sus4",

    // Power
    "0,7": "5",

    // Sixths
    "0,4,7,9": "Maj6",
    "0,3,7,9": "Min6",

    // Add9
    "0,4,7,14": "Add9",
    "0,3,7,14": "mAdd9"
};

// Helper to lookup
function getChordName(intervals) {
    const key = intervals.join(',');
    return CHORD_INTERVALS[key] || null;
}

module.exports = { getChordName, CHORD_INTERVALS };
