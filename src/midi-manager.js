const { EventEmitter } = require('events');

class MidiManager extends EventEmitter {
    constructor() {
        super();
        this.midiAccess = null;
        this.activeInput = null;
        this.activeNotes = new Set(); // Stores active MIDI note numbers
    }

    async init() {
        try {
            console.log('[MidiManager] Requesting MIDI Access...');
            this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            // Listen for state changes (plug/unplug)
            this.midiAccess.onstatechange = (e) => {
                console.log(`[MidiManager] State Change: ${e.port.name} (${e.port.state})`);
                this.emit('state-change', e);
            };
            console.log('[MidiManager] MIDI Access initialized');
            return true;
        } catch (err) {
            console.error('[MidiManager] MIDI Access Failed:', err);
            return false;
        }
    }

    getInputs() {
        if (!this.midiAccess) return [];
        return Array.from(this.midiAccess.inputs.values());
    }

    setInput(inputId) {
        if (!this.midiAccess) {
            console.warn('[MidiManager] Cannot set input: midiAccess not initialized');
            return;
        }
        if (this.activeInput) {
            this.activeInput.onmidimessage = null; // Detach previous listener
        }

        const input = this.midiAccess.inputs.get(inputId);
        if (input) {
            this.activeInput = input;
            this.activeInput.onmidimessage = (msg) => this.handleMidiMessage(msg);
            console.log(`[MidiManager] Input set to: ${input.name}`);
        } else {
            console.warn(`[MidiManager] Input ${inputId} not found.`);
        }
    }

    handleMidiMessage(message) {
        const [status, data1, data2] = message.data;
        const command = status & 0xF0;
        const channel = status & 0x0F;

        // Note On (144) with velocity > 0
        if (command === 144 && data2 > 0) {
            this.activeNotes.add(data1);
            this.emit('note-on', { note: data1, velocity: data2, channel, type: 'note-on' });
        }
        // Note Off (128) or Note On with velocity 0
        else if (command === 128 || (command === 144 && data2 === 0)) {
            this.activeNotes.delete(data1);
            this.emit('note-off', { note: data1, velocity: data2, channel, type: 'note-off' });
        }
    }

    getActiveNotes() {
        return Array.from(this.activeNotes).sort((a, b) => a - b);
    }
}

module.exports = MidiManager;
