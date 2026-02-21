const KeyDetector = require('../src/key-detector');

describe('KeyDetector', () => {
    let detector;

    beforeEach(() => {
        detector = new KeyDetector();
    });

    test('detects C Major from standard I-IV-V progression', () => {
        // C - F - G - C
        detector.addChord('C Major');
        detector.addChord('F Major');
        detector.addChord('G Major');
        detector.addChord('C Major');

        const keys = detector.detect();
        expect(keys.length).toBeGreaterThan(0);
        expect(keys[0].root).toBe('C');
        expect(keys[0].scale).toBe('Major');
    });

    test('detects A Minor from i-iv-v progression', () => {
        // Am - Dm - Em - Am
        detector.addChord('A Minor');
        detector.addChord('D Minor');
        detector.addChord('E Minor');
        detector.addChord('A Minor');

        const keys = detector.detect();
        expect(keys[0].root).toBe('A');
        expect(keys[0].scale).toBe('Minor');
    });

    test('handles ambiguous inputs gracefully', () => {
        // C Major could be C Major or G Mixolydian or F Lydian
        detector.addChord('C Major');
        const keys = detector.detect();
        // Should likely return C Major as top candidate simply due to presence
        expect(keys[0].root).toBe('C');
    });

    test('maintains a rolling buffer and adapts over time', () => {
        // First play C Major stuff
        detector.addChord('C Major');
        detector.addChord('F Major'); // Add IV to cement C Major
        detector.addChord('G Major');
        detector.addChord('C Major'); // Resolve to I
        expect(detector.detect()[0].root).toBe('C');

        // Then modulate to F# Major
        detector.addChord('F# Major');
        detector.addChord('C# Major');
        detector.addChord('B Major');
        detector.addChord('F# Major');

        // After enough input, it should switch
        // (Assuming buffer size is small enough or weighting favors recent)
        const topKey = detector.detect()[0];
        expect(topKey.root).toBe('F#');
    });
});
