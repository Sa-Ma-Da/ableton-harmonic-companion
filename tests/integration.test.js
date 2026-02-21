const MidiManager = require('../src/midi-manager');
const { detectChord } = require('../src/harmonic-analyzer');

// Mock Web MIDI API
const mockInput = {
    id: 'mock-input-1',
    name: 'Mock MIDI Device',
    state: 'connected',
    onmidimessage: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
};

const mockAccess = {
    inputs: new Map([['mock-input-1', mockInput]]),
    onstatechange: null
};

global.navigator = {
    requestMIDIAccess: jest.fn().mockResolvedValue(mockAccess)
};

describe('Integration: MIDI Input -> Harmonic Analysis', () => {
    let midiManager;

    beforeEach(async () => {
        midiManager = new MidiManager();
        const success = await midiManager.init();
        if (!success) throw new Error("MidiManager init failed in test");
        midiManager.setInput('mock-input-1');
    });

    test('Simulates C Major Chord input and detects correctly', () => {
        // We will collect active notes from the manager
        // The manager maintains state in `activeNotes` Set

        // Helper to send MIDI message
        const sendMidiMessage = (status, data1, data2) => {
            if (mockInput.onmidimessage) {
                mockInput.onmidimessage({ data: [status, data1, data2] });
            }
        };

        // 1. Play C3 (Note 48)
        sendMidiMessage(144, 48, 100); // Note On, Channel 1
        expect(midiManager.getActiveNotes()).toEqual([48]);
        expect(detectChord(midiManager.getActiveNotes())).toBeNull(); // Not enough notes

        // 2. Play E3 (Note 52)
        sendMidiMessage(144, 52, 100);
        expect(midiManager.getActiveNotes()).toEqual([48, 52]);
        expect(detectChord(midiManager.getActiveNotes())).toBeNull();

        // 3. Play G3 (Note 55) -> C Major Triad
        sendMidiMessage(144, 55, 100);
        expect(midiManager.getActiveNotes()).toEqual([48, 52, 55]);
        expect(detectChord(midiManager.getActiveNotes())).toBe('C Major');

        // 4. Play B3 (Note 59) -> C Major 7
        sendMidiMessage(144, 59, 100);
        expect(midiManager.getActiveNotes()).toEqual([48, 52, 55, 59]);
        expect(detectChord(midiManager.getActiveNotes())).toBe('C Maj7');

        // 5. Release C3 (Note Off) -> E Minor Triad (E-G-B)
        sendMidiMessage(128, 48, 0);
        expect(midiManager.getActiveNotes()).toEqual([52, 55, 59]);
        expect(detectChord(midiManager.getActiveNotes())).toBe('E Minor');
    });

    test('Handles overlapping notes correctly', () => {
        const sendMidiMessage = (status, data1, data2) => {
            if (mockInput.onmidimessage) {
                mockInput.onmidimessage({ data: [status, data1, data2] });
            }
        };

        // Sustain pedal scenario or fast playing might duplicate Note On
        sendMidiMessage(144, 60, 100); // C4
        sendMidiMessage(144, 60, 100); // C4 again
        expect(midiManager.getActiveNotes()).toEqual([60]); // Should be deduped by Set

        sendMidiMessage(128, 60, 0);
        expect(midiManager.getActiveNotes()).toEqual([]);
    });
});
