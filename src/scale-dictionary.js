/**
 * Scale Dictionary
 * Intervals relative to root.
 */
const SCALES = {
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10],           // Natural Minor
    'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
    'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
    'Ionian': [0, 2, 4, 5, 7, 9, 11],           // = Major
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Aeolian': [0, 2, 3, 5, 7, 8, 10],          // = Natural Minor
    'Locrian': [0, 1, 3, 5, 6, 8, 10],
    'Pentatonic Major': [0, 2, 4, 7, 9],
    'Pentatonic Minor': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10],
    // Blues variants
    'Blues Minor': [0, 3, 5, 6, 7, 10],
    'Blues Major': [0, 2, 3, 4, 7, 9],
    // Exotic / non-western
    'Double Harmonic Major': [0, 1, 4, 5, 7, 8, 11],
    'Phrygian Dominant': [0, 1, 4, 5, 7, 8, 10],
    'Hungarian Minor': [0, 2, 3, 6, 7, 8, 11],
    // Symmetric
    'Whole Tone': [0, 2, 4, 6, 8, 10],
    'Diminished HW': [0, 1, 3, 4, 6, 7, 9, 10],
    // Japanese
    'Insen': [0, 1, 5, 7, 10]
};

module.exports = SCALES;
