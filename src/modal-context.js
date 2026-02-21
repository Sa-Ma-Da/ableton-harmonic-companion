/**
 * Modal Context Detection
 * =======================
 * Pure functions for detecting musical modes from chord history
 * and suggesting mode-appropriate next chords. NO DOM access.
 */

const SCALES = require('./scale-dictionary');
const { CHORD_INTERVALS } = require('./chord-dictionary');

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const MODES = ['Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'];

const DEGREE_NAMES_BY_MODE = {
    'Ionian': ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    'Dorian': ['i', 'ii', 'III', 'IV', 'v', 'vi°', 'VII'],
    'Phrygian': ['i', 'II', 'III', 'iv', 'v°', 'VI', 'vii'],
    'Lydian': ['I', 'II', 'iii', 'iv°', 'V', 'vi', 'vii'],
    'Mixolydian': ['I', 'ii', 'iii°', 'IV', 'v', 'vi', 'VII'],
    'Aeolian': ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
    'Locrian': ['i°', 'II', 'iii', 'iv', 'V', 'VI', 'vii']
};

/**
 * Parse chord name → { root, quality, rootPC }
 */
function parseChord(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const root = parts[0];
    const quality = parts.slice(1).join(' ');
    const rootPC = NOTE_NAMES.indexOf(root);
    if (rootPC === -1) return null;
    return { root, quality, rootPC };
}

/**
 * Build a triad on a given degree of a scale.
 * Returns { rootPC, quality } or null.
 */
function buildTriadOnDegree(scaleIntervals, tonicPC, degreeIndex) {
    const len = scaleIntervals.length;
    if (len < 7) return null;

    const rootInterval = scaleIntervals[degreeIndex];
    const thirdInterval = scaleIntervals[(degreeIndex + 2) % len];
    const fifthInterval = scaleIntervals[(degreeIndex + 4) % len];

    const intervals = [
        0,
        (thirdInterval - rootInterval + 12) % 12,
        (fifthInterval - rootInterval + 12) % 12
    ].sort((a, b) => a - b);

    const key = intervals.join(',');
    const quality = CHORD_INTERVALS[key] || null;
    const rootPC = (tonicPC + rootInterval) % 12;

    return quality ? { rootPC, quality, name: `${NOTE_NAMES[rootPC]} ${quality}` } : null;
}

/**
 * Detect the most likely mode from a chord history.
 *
 * Scores each tonic (0–11) × mode (7 modes) combo by checking
 * how many chords in history are diatonic to that tonic+mode.
 *
 * @param {string[]} chordHistory - Array of chord names
 * @returns {{ tonic: string, mode: string, confidence: number } | null}
 */
function detectModeFromChords(chordHistory) {
    if (!Array.isArray(chordHistory) || chordHistory.length === 0) return null;

    const parsedChords = chordHistory.map(parseChord).filter(Boolean);
    if (parsedChords.length === 0) return null;

    let bestScore = -1;
    let bestResult = null;

    // Try all 12 tonics × 7 modes
    for (let tonicPC = 0; tonicPC < 12; tonicPC++) {
        for (const mode of MODES) {
            const scaleIntervals = SCALES[mode];
            if (!scaleIntervals || scaleIntervals.length < 7) continue;

            // Build diatonic triads for this tonic+mode
            const diatonicChords = [];
            for (let degree = 0; degree < 7; degree++) {
                const triad = buildTriadOnDegree(scaleIntervals, tonicPC, degree);
                if (triad) diatonicChords.push(triad);
            }

            // Score: how many input chords match diatonic chords?
            let score = 0;
            for (const chord of parsedChords) {
                const match = diatonicChords.find(dc =>
                    dc.rootPC === chord.rootPC && dc.quality === chord.quality
                );
                if (match) score++;
            }

            // Normalize by total chords
            const confidence = parsedChords.length > 0 ? score / parsedChords.length : 0;

            if (score > bestScore || (score === bestScore && bestResult && confidence > bestResult.confidence)) {
                bestScore = score;
                bestResult = {
                    tonic: NOTE_NAMES[tonicPC],
                    mode,
                    confidence: Math.round(confidence * 100) / 100
                };
            }
        }
    }

    return bestResult && bestScore > 0 ? bestResult : null;
}

/**
 * Suggest next chords based on the detected mode.
 *
 * @param {string} mode - e.g. "Dorian", "Ionian"
 * @param {string} tonic - e.g. "C", "D"
 * @param {string} [lastChord] - Last played chord to deprioritize
 * @returns {Array<{name: string, function: string, confidence: number}>}
 */
function suggestModalNextChords(mode, tonic, lastChord) {
    if (!mode || !tonic) return [];

    const scaleIntervals = SCALES[mode];
    if (!scaleIntervals || scaleIntervals.length < 7) return [];

    const tonicPC = NOTE_NAMES.indexOf(tonic);
    if (tonicPC === -1) return [];

    const degreeNames = DEGREE_NAMES_BY_MODE[mode] || [];
    const parsedLast = lastChord ? parseChord(lastChord) : null;

    const suggestions = [];

    for (let degree = 0; degree < 7; degree++) {
        const triad = buildTriadOnDegree(scaleIntervals, tonicPC, degree);
        if (!triad) continue;

        // Base confidence by degree importance
        let confidence = 0.5;
        if (degree === 0) confidence = 0.9;  // Tonic
        if (degree === 3 || degree === 4) confidence = 0.7; // IV, V equivalents

        // Deprioritize last chord
        if (parsedLast && triad.rootPC === parsedLast.rootPC && triad.quality === parsedLast.quality) {
            confidence -= 0.2;
        }

        suggestions.push({
            name: triad.name,
            function: degreeNames[degree] || `deg${degree + 1}`,
            confidence: Math.max(0, Math.min(1, confidence))
        });
    }

    suggestions.sort((a, b) => b.confidence - a.confidence);
    return suggestions;
}

module.exports = { detectModeFromChords, suggestModalNextChords };
