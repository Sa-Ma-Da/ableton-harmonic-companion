const { detectChord } = require('../src/harmonic-analyzer');

describe('HarmonicAnalyzer', () => {
    // Helper to log what we are testing (optional, jest does this well)

    test('returns null for fewer than 3 notes', () => {
        expect(detectChord([])).toBeNull();
        expect(detectChord([60])).toBeNull();
        expect(detectChord([60, 64])).toBeNull();
    });

    describe('Major Triads', () => {
        test('detects C Major (Root Position)', () => {
            // C4, E4, G4 -> 60, 64, 67
            expect(detectChord([60, 64, 67])).toBe('C Major');
        });

        test('detects C Major (1st Inversion)', () => {
            // E4, G4, C5 -> 64, 67, 72
            expect(detectChord([64, 67, 72])).toBe('C Major');
        });

        test('detects C Major (2nd Inversion)', () => {
            // G3, C4, E4 -> 55, 60, 64
            expect(detectChord([55, 60, 64])).toBe('C Major');
        });

        test('detects spread voicing (Open C Major)', () => {
            // C3, G3, E4 -> 48, 55, 64
            expect(detectChord([48, 55, 64])).toBe('C Major');
        });
    });

    describe('Minor Triads', () => {
        test('detects A Minor', () => {
            // A3, C4, E4 -> 57, 60, 64
            expect(detectChord([57, 60, 64])).toBe('A Minor');
        });
    });

    describe('7th Chords', () => {
        test('detects C Major 7', () => {
            // C4, E4, G4, B4 -> 60, 64, 67, 71
            expect(detectChord([60, 64, 67, 71])).toBe('C Maj7');
        });

        test('detects G Dominant 7', () => {
            // G3, B3, D4, F4 -> 55, 59, 62, 65
            expect(detectChord([55, 59, 62, 65])).toBe('G Dom7');
        });

        test('detects D Minor 7', () => {
            // D4, F4, A4, C5 -> 62, 65, 69, 72
            expect(detectChord([62, 65, 69, 72])).toBe('D Min7');
        });

        test('detects rootless voicing (context dependent, might fail if strict)', () => {
            // E.g., B D F (Diminished) might be G7 rootless. 
            // Our current logic is strict interval matching based on present notes.
            // So B-D-F should be B Diminished.
            expect(detectChord([59, 62, 65])).toBe('B Diminished');
        });
    });

    describe('Suspended Chords', () => {
        test('detects D Sus4', () => {
            // D4, G4, A4 -> 62, 67, 69
            expect(detectChord([62, 67, 69])).toBe('D Sus4');
        });

        test('detects C Sus2', () => {
            // C4, D4, G4 -> 60, 62, 67
            expect(detectChord([60, 62, 67])).toBe('C Sus2');
        });
    });

    describe('Edge Cases', () => {
        test('handles duplicate notes across octaves', () => {
            // C3, C4, E4, G4, G5
            expect(detectChord([48, 60, 64, 67, 79])).toBe('C Major');
        });

        test('handles unsorted input', () => {
            // G4, C4, E4 (mixed order)
            expect(detectChord([67, 60, 64])).toBe('C Major');
        });
    });
});
