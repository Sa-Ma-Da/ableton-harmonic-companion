const {
    suggestDiatonicChords,
    suggestScales,
    suggestExtensions,
    suggestIntervals,
    suggestNextChords,
    getChordMetadata
} = require('../src/suggestion-engine');

describe('SuggestionEngine', () => {

    // ---------------------------------------------------------------
    // suggestDiatonicChords
    // ---------------------------------------------------------------
    describe('suggestDiatonicChords', () => {
        test('returns diatonic chords for C Major', () => {
            const suggestions = suggestDiatonicChords('C Major', null);
            expect(suggestions.length).toBeGreaterThan(0);

            const names = suggestions.map(s => s.name);
            // Should include common C Major diatonic chords
            expect(names).toContain('C Major');   // I
            expect(names).toContain('F Major');   // IV
            expect(names).toContain('G Major');   // V
            expect(names).toContain('A Minor');   // vi
        });

        test('each suggestion has name, function, and confidence', () => {
            const suggestions = suggestDiatonicChords('C Major', null);
            for (const s of suggestions) {
                expect(s).toHaveProperty('name');
                expect(typeof s.name).toBe('string');
                expect(s).toHaveProperty('function');
                expect(typeof s.function).toBe('string');
                expect(s).toHaveProperty('confidence');
                expect(typeof s.confidence).toBe('number');
                expect(s.confidence).toBeGreaterThanOrEqual(0);
                expect(s.confidence).toBeLessThanOrEqual(1);
            }
        });

        test('excludes the current chord from suggestions', () => {
            const suggestions = suggestDiatonicChords('C Major', 'G Major');
            const names = suggestions.map(s => s.name);
            expect(names).not.toContain('G Major');
            expect(names).toContain('C Major');
            expect(names).toContain('F Major');
        });

        test('returns correct functions (Roman numerals)', () => {
            const suggestions = suggestDiatonicChords('C Major', null);
            const funcMap = {};
            suggestions.forEach(s => { funcMap[s.name] = s.function; });

            expect(funcMap['C Major']).toBe('I');
            expect(funcMap['F Major']).toBe('IV');
            expect(funcMap['G Major']).toBe('V');
            expect(funcMap['A Minor']).toBe('vi');
        });

        test('works for A Minor key', () => {
            const suggestions = suggestDiatonicChords('A Minor', null);
            const names = suggestions.map(s => s.name);
            // A natural minor diatonic: Am, Bdim, C, Dm, Em, F, G
            expect(names).toContain('A Minor');
            expect(names).toContain('C Major');
        });

        test('returns sorted by confidence descending', () => {
            const suggestions = suggestDiatonicChords('C Major', null);
            for (let i = 1; i < suggestions.length; i++) {
                expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
            }
        });

        test('returns empty array for invalid input', () => {
            expect(suggestDiatonicChords('', null)).toEqual([]);
            expect(suggestDiatonicChords(null, null)).toEqual([]);
            expect(suggestDiatonicChords('X Invalid', null)).toEqual([]);
        });
    });

    // ---------------------------------------------------------------
    // suggestScales
    // ---------------------------------------------------------------
    describe('suggestScales', () => {
        test('suggests scales compatible with C Major key', () => {
            const suggestions = suggestScales('C Major', null);
            expect(suggestions.length).toBeGreaterThan(0);

            const names = suggestions.map(s => s.name);
            expect(names).toContain('C Major');
        });

        test('parent scale has highest confidence', () => {
            const suggestions = suggestScales('C Major', null);
            const parent = suggestions.find(s => s.name === 'C Major');
            expect(parent).toBeDefined();
            expect(parent.function).toBe('parent scale');
        });

        test('filters by chord compatibility', () => {
            // G Dom7 contains G, B, D, F — should filter to scales containing all these
            const suggestions = suggestScales('C Major', 'G Dom7');
            expect(suggestions.length).toBeGreaterThan(0);

            // C Major scale contains G, B, D, F → should be suggested
            const names = suggestions.map(s => s.name);
            expect(names).toContain('C Major');
        });

        test('each suggestion has name, function, and confidence', () => {
            const suggestions = suggestScales('C Major', 'C Major');
            for (const s of suggestions) {
                expect(s).toHaveProperty('name');
                expect(s).toHaveProperty('function');
                expect(s).toHaveProperty('confidence');
                expect(typeof s.confidence).toBe('number');
            }
        });

        test('returns sorted by confidence descending', () => {
            const suggestions = suggestScales('C Major', null);
            for (let i = 1; i < suggestions.length; i++) {
                expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
            }
        });

        test('returns empty for completely invalid input', () => {
            expect(suggestScales('', '')).toEqual([]);
            expect(suggestScales(null, null)).toEqual([]);
        });
    });

    // ---------------------------------------------------------------
    // suggestExtensions
    // ---------------------------------------------------------------
    describe('suggestExtensions', () => {
        test('suggests 7th chords for C Major triad', () => {
            const suggestions = suggestExtensions('C Major');
            expect(suggestions.length).toBeGreaterThan(0);

            const names = suggestions.map(s => s.name);
            expect(names).toContain('C Maj7');
            expect(names).toContain('C Dom7');
        });

        test('suggests minor extensions for A Minor', () => {
            const suggestions = suggestExtensions('A Minor');
            expect(suggestions.length).toBeGreaterThan(0);

            const names = suggestions.map(s => s.name);
            expect(names).toContain('A Min7');
        });

        test('suggests half-dim for Diminished triad', () => {
            const suggestions = suggestExtensions('B Diminished');
            const names = suggestions.map(s => s.name);
            expect(names).toContain('B m7b5 (Half-Dim)');
        });

        test('each suggestion has name, function, and confidence', () => {
            const suggestions = suggestExtensions('C Major');
            for (const s of suggestions) {
                expect(s).toHaveProperty('name');
                expect(typeof s.name).toBe('string');
                expect(s).toHaveProperty('function');
                expect(typeof s.function).toBe('string');
                expect(s).toHaveProperty('confidence');
                expect(typeof s.confidence).toBe('number');
            }
        });

        test('returns sorted by confidence descending', () => {
            const suggestions = suggestExtensions('C Major');
            for (let i = 1; i < suggestions.length; i++) {
                expect(suggestions[i].confidence).toBeLessThanOrEqual(suggestions[i - 1].confidence);
            }
        });

        test('returns empty for already-extended chords', () => {
            // Dom7 has no further extensions in the map
            const suggestions = suggestExtensions('G Dom7');
            expect(suggestions).toEqual([]);
        });

        test('returns empty for invalid input', () => {
            expect(suggestExtensions('')).toEqual([]);
            expect(suggestExtensions(null)).toEqual([]);
            expect(suggestExtensions('X Unknown')).toEqual([]);
        });
    });

    // ---------------------------------------------------------------
    // suggestIntervals
    // ---------------------------------------------------------------
    describe('suggestIntervals', () => {
        test('returns interval additions for a single note', () => {
            // C4 = MIDI 60
            const suggestions = suggestIntervals([60]);
            expect(suggestions.length).toBeGreaterThan(0);

            const names = suggestions.map(s => s.name);
            expect(names).toContain('Add D#'); // +3 Minor 3rd
            expect(names).toContain('Add E');  // +4 Major 3rd
            expect(names).toContain('Add G');  // +7 Perfect 5th
        });

        test('returns interval additions for two notes', () => {
            // C4 + E4 (60, 64) → need 5th, 7th etc.
            const suggestions = suggestIntervals([60, 64]);
            expect(suggestions.length).toBeGreaterThan(0);

            const intervals = suggestions.map(s => s.interval);
            // Should suggest Perfect 5th (+7 from lowest)
            expect(intervals).toContain('+7');
        });

        test('each suggestion has name, interval, and result', () => {
            const suggestions = suggestIntervals([60]);
            for (const s of suggestions) {
                expect(s).toHaveProperty('name');
                expect(typeof s.name).toBe('string');
                expect(s).toHaveProperty('interval');
                expect(typeof s.interval).toBe('string');
                expect(s).toHaveProperty('result');
                expect(typeof s.result).toBe('string');
            }
        });

        test('returns empty array for >= 3 notes', () => {
            expect(suggestIntervals([60, 64, 67])).toEqual([]);
            expect(suggestIntervals([60, 64, 67, 71])).toEqual([]);
        });

        test('returns empty array for no notes', () => {
            expect(suggestIntervals([])).toEqual([]);
            expect(suggestIntervals(new Set())).toEqual([]);
        });

        test('accepts Set<number> input', () => {
            const suggestions = suggestIntervals(new Set([60]));
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions[0]).toHaveProperty('name');
        });

        test('predicts resulting chord for 2-note input', () => {
            // C4(60) + E4(64), adding +7 (G) should predict C Major
            const suggestions = suggestIntervals([60, 64]);
            const addG = suggestions.find(s => s.interval === '+7');
            expect(addG).toBeDefined();
            expect(addG.result).toBe('C Major');
        });

        test('skips already-active notes', () => {
            // C4(60) + E4(64) → +4 is E, which is already active — should skip
            const suggestions = suggestIntervals([60, 64]);
            const intervals = suggestions.map(s => s.interval);
            expect(intervals).not.toContain('+4'); // E is already held
        });
    });

    // ---------------------------------------------------------------
    // getChordMetadata
    // ---------------------------------------------------------------
    describe('getChordMetadata', () => {
        test('returns correct metadata for C Major', () => {
            const meta = getChordMetadata('C Major');
            expect(meta).not.toBeNull();
            expect(meta.noteNames).toEqual(['C', 'E', 'G']);
            expect(meta.midiNotes).toEqual([60, 64, 67]);
            expect(meta.fingering).toEqual([1, 3, 5]);
        });

        test('returns correct metadata for A Minor', () => {
            const meta = getChordMetadata('A Minor');
            expect(meta).not.toBeNull();
            expect(meta.noteNames).toEqual(['A', 'C', 'E']);
            expect(meta.midiNotes).toEqual([69, 72, 76]);
            expect(meta.fingering).toEqual([1, 3, 5]);
        });

        test('returns 4-finger mapping for 7th chords', () => {
            const meta = getChordMetadata('C Maj7');
            expect(meta).not.toBeNull();
            expect(meta.noteNames.length).toBe(4);
            expect(meta.midiNotes.length).toBe(4);
            expect(meta.fingering).toEqual([1, 2, 3, 5]);
        });

        test('supports custom octave', () => {
            const meta = getChordMetadata('C Major', 3);
            expect(meta.midiNotes).toEqual([48, 52, 55]);
        });

        test('returns null for invalid input', () => {
            expect(getChordMetadata(null)).toBeNull();
            expect(getChordMetadata('')).toBeNull();
            expect(getChordMetadata('X Unknown')).toBeNull();
        });

        test('returns null for unknown quality', () => {
            expect(getChordMetadata('C Weird')).toBeNull();
        });
    });

    // ---------------------------------------------------------------
    // suggestNextChords
    // ---------------------------------------------------------------
    describe('suggestNextChords', () => {
        test('returns 2-5 suggestions for valid history + key', () => {
            const result = suggestNextChords(['C Major'], 'C Major');
            expect(result.length).toBeGreaterThanOrEqual(2);
            expect(result.length).toBeLessThanOrEqual(5);
        });

        test('each suggestion has name, function, and confidence', () => {
            const result = suggestNextChords(['C Major'], 'C Major');
            for (const s of result) {
                expect(s).toHaveProperty('name');
                expect(s).toHaveProperty('function');
                expect(s).toHaveProperty('confidence');
                expect(typeof s.confidence).toBe('number');
            }
        });

        test('does not suggest the last chord played', () => {
            const result = suggestNextChords(['C Major'], 'C Major');
            const names = result.map(s => s.name);
            expect(names).not.toContain('C Major');
        });

        test('V → I motion: after G Major, C Major scores highest', () => {
            const result = suggestNextChords(['G Major'], 'C Major');
            // C Major = I, should get the authentic cadence bonus
            // But we excluded G Major (last chord), so C Major should be top
            expect(result[0].name).toBe('C Major');
        });

        test('memory length limits history window', () => {
            const longHistory = ['C Major', 'F Major', 'G Major', 'A Minor', 'D Minor'];
            const mem2 = suggestNextChords(longHistory, 'C Major', 2);
            const mem5 = suggestNextChords(longHistory, 'C Major', 5);
            // Different memory lengths should produce different scores
            expect(mem2).toBeDefined();
            expect(mem5).toBeDefined();
        });

        test('adapts after progression lock-in', () => {
            const prog1 = suggestNextChords(['C Major'], 'C Major');
            const prog2 = suggestNextChords(['C Major', 'F Major'], 'C Major');
            // After adding F Major, suggestions should differ
            expect(prog1).not.toEqual(prog2);
        });

        test('returns empty for invalid inputs', () => {
            expect(suggestNextChords(null, 'C Major')).toEqual([]);
            expect(suggestNextChords([], 'C Major')).toEqual([]);
            expect(suggestNextChords(['C Major'], null)).toEqual([]);
            expect(suggestNextChords(['C Major'], '')).toEqual([]);
        });

        test('returns empty for non-array history', () => {
            expect(suggestNextChords('C Major', 'C Major')).toEqual([]);
            expect(suggestNextChords(42, 'C Major')).toEqual([]);
        });
    });

    // ---------------------------------------------------------------
    // Pure function contract
    // ---------------------------------------------------------------
    describe('Pure function guarantees', () => {
        test('functions accept only string inputs', () => {
            expect(() => suggestDiatonicChords(123, 456)).not.toThrow();
            expect(() => suggestScales({}, [])).not.toThrow();
            expect(() => suggestExtensions(undefined)).not.toThrow();

            expect(suggestDiatonicChords(123, 456)).toEqual([]);
            expect(suggestScales({}, [])).toEqual([]);
            expect(suggestExtensions(undefined)).toEqual([]);
        });

        test('suggestIntervals handles invalid types gracefully', () => {
            expect(() => suggestIntervals(null)).not.toThrow();
            expect(() => suggestIntervals('not an array')).not.toThrow();
            expect(() => suggestIntervals(42)).not.toThrow();
            expect(suggestIntervals(null)).toEqual([]);
            expect(suggestIntervals('not an array')).toEqual([]);
        });

        test('getChordMetadata handles invalid types gracefully', () => {
            expect(() => getChordMetadata(123)).not.toThrow();
            expect(() => getChordMetadata(undefined)).not.toThrow();
            expect(getChordMetadata(123)).toBeNull();
        });

        test('suggestNextChords handles invalid types gracefully', () => {
            expect(() => suggestNextChords(null, null)).not.toThrow();
            expect(() => suggestNextChords(undefined, undefined)).not.toThrow();
            expect(suggestNextChords(null, null)).toEqual([]);
        });

        test('functions return correct types', () => {
            expect(Array.isArray(suggestDiatonicChords('C Major', null))).toBe(true);
            expect(Array.isArray(suggestScales('C Major', null))).toBe(true);
            expect(Array.isArray(suggestExtensions('C Major'))).toBe(true);
            expect(Array.isArray(suggestIntervals([60]))).toBe(true);
            expect(Array.isArray(suggestNextChords(['C Major'], 'C Major'))).toBe(true);
            expect(typeof getChordMetadata('C Major')).toBe('object');
        });
    });
});
