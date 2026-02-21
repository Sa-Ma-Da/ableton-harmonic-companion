/**
 * Suggestion Engine
 * =================
 * Pure functions for harmonic suggestions. NO DOM access.
 * All inputs are strings, all outputs are arrays of suggestion objects.
 */

const SCALES = require('./scale-dictionary');
const { CHORD_INTERVALS } = require('./chord-dictionary');

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const DEGREE_NAMES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

// ---- Extension Classification ----
const QUALITY_DEPENDENT_EXTENSIONS = [
    'Maj7', 'min7', '#11', 'b9', 'b6'
];

const MODAL_STACK_EXTENSIONS = [
    'add2', 'add4', 'add6', 'add9', 'add11', 'add13', 'no3', 'no5'
];

// ---- Helpers (internal) ----

/**
 * Parse a note name to its pitch class (0-11). Returns -1 if invalid.
 */
function noteToPC(name) {
    return NOTE_NAMES.indexOf(name);
}

/**
 * Calculate voice leading cost between two sets of MIDI notes.
 * Sum of minimum distances from each note in prevNotes to closest note in nextNotes.
 * Lower cost = better voice leading (smoother motion).
 */
function calculateVoiceLeadingCost(prevNotes, nextNotes) {
    let cost = 0;
    prevNotes.forEach(p => {
        let min = Infinity;
        nextNotes.forEach(n => {
            min = Math.min(min, Math.abs(p - n));
        });
        cost += min;
    });
    return cost;
}

/**
 * Parse "C Major" → { root: 'C', quality: 'Major', rootPC: 0 }
 */
function parseChordOrKey(str) {
    if (!str || typeof str !== 'string') return null;
    const parts = str.trim().split(/\s+/);
    if (parts.length < 2) return null;
    const root = parts[0];
    const quality = parts.slice(1).join(' ');
    const rootPC = noteToPC(root);
    if (rootPC === -1) return null;
    return { root, quality, rootPC };
}

/**
 * Get intervals for a chord quality from CHORD_INTERVALS.
 */
function getIntervalsForQuality(quality) {
    for (const [key, val] of Object.entries(CHORD_INTERVALS)) {
        if (val === quality) {
            return key.split(',').map(Number);
        }
    }
    return null;
}

/**
 * Build a triad from a scale at a given degree index.
 * Returns { intervals, quality } or null.
 */
function buildTriadOnDegree(scaleIntervals, degreeIndex) {
    const len = scaleIntervals.length;
    if (len < 7) return null; // Need 7-note scale for diatonic triads

    const root = scaleIntervals[degreeIndex];
    const third = scaleIntervals[(degreeIndex + 2) % len];
    const fifth = scaleIntervals[(degreeIndex + 4) % len];

    // Normalize intervals relative to root
    const intervals = [
        0,
        (third - root + 12) % 12,
        (fifth - root + 12) % 12
    ].sort((a, b) => a - b);

    // Look up quality
    const key = intervals.join(',');
    const quality = CHORD_INTERVALS[key] || null;

    return { intervals, quality, rootPC: root };
}

// ---- Public API ----

/**
 * Suggest diatonic chords in the given key, highlighting the current chord's position.
 *
 * @param {string} key - e.g. "C Major", "A Minor"
 * @param {string} currentChord - e.g. "G Major", "D Minor"
 * @returns {Array<{name: string, function?: string, confidence?: number}>}
 */
function suggestDiatonicChords(key, currentChord) {
    const parsedKey = parseChordOrKey(key);
    if (!parsedKey) return [];

    const scaleIntervals = SCALES[parsedKey.quality];
    if (!scaleIntervals || scaleIntervals.length < 7) return [];

    const parsedCurrent = currentChord ? parseChordOrKey(currentChord) : null;
    const suggestions = [];

    for (let degree = 0; degree < 7; degree++) {
        const triad = buildTriadOnDegree(scaleIntervals, degree);
        if (!triad || !triad.quality) continue;

        const absoluteRoot = (parsedKey.rootPC + scaleIntervals[degree]) % 12;
        const chordName = `${NOTE_NAMES[absoluteRoot]} ${triad.quality}`;
        const degreeName = DEGREE_NAMES[degree];

        // Confidence: higher for common progressions (I, IV, V, vi)
        let confidence = 0.5;
        if ([0, 3, 4, 5].includes(degree)) confidence = 0.8;
        if (degree === 0) confidence = 1.0; // Tonic
        if (degree === 4) confidence = 0.9; // Dominant

        // Is this the current chord?
        const isCurrent = parsedCurrent &&
            absoluteRoot === parsedCurrent.rootPC &&
            triad.quality === parsedCurrent.quality;

        if (isCurrent) continue; // Don't suggest the current chord

        suggestions.push({
            name: chordName,
            function: degreeName,
            confidence
        });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest scales that fit the given key and current chord.
 *
 * @param {string} key - e.g. "C Major"
 * @param {string} currentChord - e.g. "G Dom7"
 * @returns {Array<{name: string, function?: string, confidence?: number}>}
 */
function suggestScales(key, currentChord) {
    const parsedKey = parseChordOrKey(key);
    const parsedChord = currentChord ? parseChordOrKey(currentChord) : null;

    // Need at least a valid key or chord to suggest scales
    if (!parsedKey && !parsedChord) return [];

    // Get chord notes (pitch classes) if we have a chord
    let chordPCs = [];
    if (parsedChord) {
        const chordIntervals = getIntervalsForQuality(parsedChord.quality);
        if (chordIntervals) {
            chordPCs = chordIntervals.map(i => (parsedChord.rootPC + i) % 12);
        }
    }

    const suggestions = [];

    for (const [scaleName, scaleIntervals] of Object.entries(SCALES)) {
        // Build scale rooted on the key root (or chord root if no key)
        const root = parsedKey ? parsedKey.rootPC : (parsedChord ? parsedChord.rootPC : 0);
        const scalePCs = new Set(scaleIntervals.map(i => (root + i) % 12));

        // Score: how many chord notes fit this scale?
        let chordFit = 0;
        if (chordPCs.length > 0) {
            for (const pc of chordPCs) {
                if (scalePCs.has(pc)) chordFit++;
            }
        }

        const chordScore = chordPCs.length > 0 ? chordFit / chordPCs.length : 0.5;

        // Bonus for matching the key's own scale
        let keyBonus = 0;
        if (parsedKey && scaleName === parsedKey.quality) {
            keyBonus = 0.2;
        }

        const confidence = Math.min(1.0, chordScore + keyBonus);

        // Only suggest if all chord notes fit (confidence >= threshold)
        if (chordPCs.length > 0 && chordScore < 1.0) continue;

        const displayName = `${NOTE_NAMES[root]} ${scaleName}`;

        suggestions.push({
            name: displayName,
            function: scaleName === (parsedKey ? parsedKey.quality : '') ? 'parent scale' : 'compatible',
            confidence: parseFloat(confidence.toFixed(2))
        });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest chord extensions for the current chord.
 *
 * @param {string} currentChord - e.g. "C Major", "A Minor"
 * @returns {Array<{name: string, function?: string, confidence?: number}>}
 */
function suggestExtensions(currentChord) {
    const parsed = parseChordOrKey(currentChord);
    if (!parsed) return [];

    const currentIntervals = getIntervalsForQuality(parsed.quality);
    if (!currentIntervals) return [];

    const suggestions = [];

    // Extension map: from base quality → possible extensions
    const EXTENSION_MAP = {
        'Major': [
            { quality: 'Maj7', function: 'add major 7th', confidence: 0.9 },
            { quality: 'Dom7', function: 'add dominant 7th', confidence: 0.8 },
            { quality: 'Maj6', function: 'add major 6th', confidence: 0.7 },
            { quality: 'Sus4', function: 'suspend to 4th', confidence: 0.5 },
            { quality: 'Sus2', function: 'suspend to 2nd', confidence: 0.5 },
            { quality: 'Add9', function: 'add 9th', confidence: 0.6 },
        ],
        'Minor': [
            { quality: 'Min7', function: 'add minor 7th', confidence: 0.9 },
            { quality: 'MinMaj7', function: 'add major 7th', confidence: 0.5 },
            { quality: 'Min6', function: 'add major 6th', confidence: 0.6 },
            { quality: 'mAdd9', function: 'add 9th', confidence: 0.6 },
        ],
        'Diminished': [
            { quality: 'm7b5 (Half-Dim)', function: 'add minor 7th', confidence: 0.8 },
            { quality: 'Dim7', function: 'add diminished 7th', confidence: 0.7 },
        ],
        'Augmented': [],
        'Dom7': [],
        'Maj7': [],
        'Min7': [],
    };

    const extensions = EXTENSION_MAP[parsed.quality] || [];

    for (const ext of extensions) {
        suggestions.push({
            name: `${parsed.root} ${ext.quality}`,
            function: ext.function,
            confidence: ext.confidence
        });
    }

    // Modal stack extensions for suspended / power / modal voicings
    const intervals = getIntervalsForQuality(parsed.quality);
    if (intervals) {
        const hasMinor3rd = intervals.includes(3);
        const hasMajor3rd = intervals.includes(4);
        const isModalVoicing = !hasMinor3rd && !hasMajor3rd;

        if (isModalVoicing) {
            for (const ext of MODAL_STACK_EXTENSIONS) {
                suggestions.push({
                    name: ext,
                    function: `modal stack: ${ext}`,
                    confidence: 0.6,
                    quality: ext
                });
            }
        }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Suggest interval additions when fewer than 3 notes are active.
 *
 * @param {Set<number>|Array<number>} activeNotes - MIDI note numbers
 * @returns {Array<{name: string, interval: string, result: string}>}
 */
function suggestIntervals(activeNotes) {
    // Normalize input
    const notes = activeNotes instanceof Set
        ? Array.from(activeNotes)
        : (Array.isArray(activeNotes) ? activeNotes : []);

    if (notes.length === 0 || notes.length >= 3) return [];

    const sorted = [...notes].sort((a, b) => a - b);
    const lowest = sorted[0];
    const lowestName = NOTE_NAMES[lowest % 12];

    const INTERVAL_ADDITIONS = [
        { semitones: 3, label: 'Minor 3rd' },
        { semitones: 4, label: 'Major 3rd' },
        { semitones: 7, label: 'Perfect 5th' },
        { semitones: 10, label: 'Minor 7th' },
        { semitones: 11, label: 'Major 7th' }
    ];

    const suggestions = [];

    for (const interval of INTERVAL_ADDITIONS) {
        const newNote = lowest + interval.semitones;
        const newNoteName = NOTE_NAMES[newNote % 12];

        // Skip if this note is already active
        if (notes.includes(newNote) || notes.includes(newNote % 12 + Math.floor(lowest / 12) * 12)) {
            continue;
        }

        // Predict what chord the addition would form
        const hypothetical = [...sorted, newNote].sort((a, b) => a - b);
        let result = '—';

        // Only predict chord if we'd have 3+ notes
        if (hypothetical.length >= 3) {
            // Use CHORD_INTERVALS to detect
            const pitchClasses = [...new Set(hypothetical.map(n => n % 12))].sort((a, b) => a - b);
            if (pitchClasses.length >= 3) {
                // Try each note as root
                for (const root of pitchClasses) {
                    const intervals = pitchClasses.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b);
                    const key = intervals.join(',');
                    if (CHORD_INTERVALS[key]) {
                        result = `${NOTE_NAMES[root]} ${CHORD_INTERVALS[key]}`;
                        break;
                    }
                }
            }
        }

        suggestions.push({
            name: `Add ${newNoteName}`,
            interval: `+${interval.semitones}`,
            result
        });
    }

    return suggestions;
}

/**
 * Suggest next chords based on chord history, key, and progression memory.
 * Uses common harmonic motion patterns to score candidates.
 *
 * @param {string[]} chordHistory - Array of chord names, most recent last
 * @param {string} key - e.g. "C Major"
 * @param {number} [memoryLength=3] - How many previous chords to consider
 * @returns {Array<{name: string, function?: string, confidence: number}>}
 */
function suggestNextChords(chordHistory, key, memoryLength = 3) {
    if (!Array.isArray(chordHistory) || chordHistory.length === 0) return [];

    const parsedKey = parseChordOrKey(key);
    if (!parsedKey) return [];

    const scaleIntervals = SCALES[parsedKey.quality];
    if (!scaleIntervals || scaleIntervals.length < 7) return [];

    // Build diatonic chord table: degree → { name, rootPC, quality }
    const diatonic = [];
    for (let degree = 0; degree < 7; degree++) {
        const triad = buildTriadOnDegree(scaleIntervals, degree);
        if (!triad || !triad.quality) continue;
        const absoluteRoot = (parsedKey.rootPC + scaleIntervals[degree]) % 12;
        diatonic.push({
            degree,
            name: `${NOTE_NAMES[absoluteRoot]} ${triad.quality}`,
            degreeName: DEGREE_NAMES[degree],
            rootPC: absoluteRoot,
            quality: triad.quality
        });
    }

    if (diatonic.length === 0) return [];

    // Get recent history window
    const recentHistory = chordHistory.slice(-memoryLength);
    const lastChord = recentHistory[recentHistory.length - 1];
    const parsedLast = parseChordOrKey(lastChord);

    // Map last chord to degree
    let lastDegree = -1;
    if (parsedLast) {
        const match = diatonic.find(d => d.rootPC === parsedLast.rootPC && d.quality === parsedLast.quality);
        if (match) lastDegree = match.degree;
    }

    // Common harmonic motion rules: from degree → to degree → bonus
    const MOTION_RULES = [
        // V → I (authentic cadence)
        { from: 4, to: 0, bonus: 0.35 },
        // IV → V (pre-dominant → dominant)
        { from: 3, to: 4, bonus: 0.25 },
        // I → IV (plagal motion)
        { from: 0, to: 3, bonus: 0.2 },
        // I → V (tonic → dominant)
        { from: 0, to: 4, bonus: 0.2 },
        // vi → IV (common pop progression)
        { from: 5, to: 3, bonus: 0.2 },
        // V → vi (deceptive cadence)
        { from: 4, to: 5, bonus: 0.15 },
        // ii → V (jazz ii-V)
        { from: 1, to: 4, bonus: 0.25 },
        // I → vi (relative minor)
        { from: 0, to: 5, bonus: 0.15 },
        // IV → I (plagal cadence)
        { from: 3, to: 0, bonus: 0.3 },
        // iii → vi (mediant motion)
        { from: 2, to: 5, bonus: 0.1 },
        // vi → ii (descending fifths)
        { from: 5, to: 1, bonus: 0.15 }
    ];

    // Score each diatonic chord
    const scored = diatonic.map(candidate => {
        let score = candidate.degree === 0 ? 0.5 :
            candidate.degree === 4 ? 0.4 :
                candidate.degree === 3 ? 0.35 :
                    candidate.degree === 5 ? 0.3 : 0.2;

        // Apply motion rules from last chord
        if (lastDegree >= 0) {
            for (const rule of MOTION_RULES) {
                if (rule.from === lastDegree && rule.to === candidate.degree) {
                    score += rule.bonus;
                    break;
                }
            }
        }

        // Mild deprioritization for repeating the last chord (still appears as option)
        if (parsedLast && candidate.rootPC === parsedLast.rootPC && candidate.quality === parsedLast.quality) {
            score -= 0.35;
        }

        // Small penalty for chords already in recent history
        for (const histChord of recentHistory) {
            const parsed = parseChordOrKey(histChord);
            if (parsed && candidate.rootPC === parsed.rootPC && candidate.quality === parsed.quality) {
                score -= 0.1;
            }
        }

        return {
            name: candidate.name,
            function: candidate.degreeName,
            confidence: Math.max(0, Math.min(1, score))
        };
    });

    // Voice Leading Optimization
    if (parsedLast) {
        const prevMeta = getChordMetadata(lastChord, 4);
        if (prevMeta && prevMeta.midiNotes) {
            scored.forEach(s => {
                const nextMeta = getChordMetadata(s.name, 4);
                if (nextMeta && nextMeta.midiNotes) {
                    const cost = calculateVoiceLeadingCost(prevMeta.midiNotes, nextMeta.midiNotes);
                    s.voiceCost = cost;
                    // Penalize high movement cost
                    s.confidence -= (cost * 0.05);
                    // Clamping
                    s.confidence = Math.max(0, Math.min(1, s.confidence));
                }
            });
        }
    }

    // Sort by confidence descending, take top 2–5
    scored.sort((a, b) => b.confidence - a.confidence);
    return scored.filter(s => s.confidence > 0).slice(0, 5);
}

/**
 * Get chord metadata: note names, MIDI numbers, and piano fingering.
 *
 * @param {string} chordName - e.g. "C Major", "A Minor"
 * @param {number} [octave=4] - base octave for MIDI numbers
 * @returns {{ noteNames: string[], midiNotes: number[], fingering: number[] } | null}
 */
function getChordMetadata(chordName, octave = 4) {
    const parsed = parseChordOrKey(chordName);
    if (!parsed) return null;

    const intervals = getIntervalsForQuality(parsed.quality);
    if (!intervals) return null;

    const baseNote = parsed.rootPC + (octave + 1) * 12; // MIDI: C4 = 60

    const midiNotes = intervals.map(i => baseNote + i);
    const noteNames = midiNotes.map(n => NOTE_NAMES[n % 12]);

    // RH piano fingering (root-position assumption)
    const FINGERING_MAP = {
        3: [1, 3, 5],
        4: [1, 2, 3, 5],
        5: [1, 2, 3, 4, 5]
    };
    const fingering = FINGERING_MAP[midiNotes.length] || midiNotes.map((_, i) => i + 1);

    return { noteNames, midiNotes, fingering };
}

/**
 * Apply an extension to a base chord, producing a new chord name.
 * E.g. applyExtension("C Major", "Maj7") → "C Maj7"
 *
 * @param {string} baseChord - e.g. "C Major", "A Minor"
 * @param {string} extensionType - e.g. "Maj7", "Dom7", "Min7", "Sus4"
 * @returns {string|null} - New chord name or null if invalid
 */
function applyExtension(baseChord, extensionType) {
    const parsed = parseChordOrKey(baseChord);
    if (!parsed) return null;
    if (!extensionType || typeof extensionType !== 'string') return null;

    // Get intervals for the base chord quality (handle compound modals like "Sus4 add2")
    const qualityParts = parsed.quality.split(' ');
    let intervals = getIntervalsForQuality(parsed.quality);
    let baseQuality = parsed.quality;

    // If direct lookup fails, try base quality (first word) for compound modal chords
    if (!intervals && qualityParts.length > 1) {
        baseQuality = qualityParts[0];
        intervals = getIntervalsForQuality(baseQuality);
        // Verify remaining parts are all modal stack extensions
        const modifiers = qualityParts.slice(1);
        if (intervals && !modifiers.every(m => MODAL_STACK_EXTENSIONS.includes(m))) {
            intervals = null; // Not a valid compound modal
        }
    }

    // Detect suspended / modal voicing
    const hasMinor3rd = intervals ? intervals.includes(3) : false;
    const hasMajor3rd = intervals ? intervals.includes(4) : false;
    const isModalVoicing = intervals ? (!hasMinor3rd && !hasMajor3rd) : false;

    // Reject quality-dependent extensions on modal voicings
    if (isModalVoicing && QUALITY_DEPENDENT_EXTENSIONS.includes(extensionType)) {
        return null;
    }

    // Handle modal stack extensions
    if (isModalVoicing && MODAL_STACK_EXTENSIONS.includes(extensionType)) {
        const intervalSet = new Set(intervals);

        switch (extensionType) {
            case 'add2': intervalSet.add(2); break;
            case 'add4': intervalSet.add(5); break;
            case 'add6': intervalSet.add(9); break;
            case 'add9': intervalSet.add(14); break;
            case 'add11': intervalSet.add(17); break;
            case 'add13': intervalSet.add(21); break;
            case 'no3': intervalSet.delete(3); intervalSet.delete(4); break;
            case 'no5': intervalSet.delete(7); break;
        }

        // Build a descriptive chord name
        const modifiers = parsed.quality.includes(' ')
            ? parsed.quality.split(' ')
            : [parsed.quality];
        // Avoid duplicating existent modifier
        if (!modifiers.includes(extensionType)) {
            modifiers.push(extensionType);
        }
        return `${parsed.root} ${modifiers.join(' ')}`;
    }

    // Original tonal extension logic
    const VALID_EXTENSIONS = {
        'Major': ['Maj7', 'Dom7', 'Maj6', 'Sus4', 'Sus2', 'Add9', '7sus4'],
        'Minor': ['Min7', 'MinMaj7', 'Min6', 'mAdd9'],
        'Diminished': ['m7b5 (Half-Dim)', 'Dim7'],
        'Augmented': []
    };

    const allowed = VALID_EXTENSIONS[parsed.quality];
    if (!allowed || !allowed.includes(extensionType)) {
        const knownQualities = ['Maj7', 'Dom7', 'Min7', 'MinMaj7', 'm7b5 (Half-Dim)', 'Dim7',
            'Sus4', 'Sus2', '7sus4', 'Maj6', 'Min6', 'Add9', 'mAdd9',
            'Major', 'Minor', 'Diminished', 'Augmented', '5'];
        if (!knownQualities.includes(extensionType)) return null;
    }

    return `${parsed.root} ${extensionType}`;
}

module.exports = {
    suggestDiatonicChords, suggestScales, suggestExtensions, suggestIntervals,
    suggestNextChords, getChordMetadata, applyExtension, calculateVoiceLeadingCost,
    QUALITY_DEPENDENT_EXTENSIONS, MODAL_STACK_EXTENSIONS
};

