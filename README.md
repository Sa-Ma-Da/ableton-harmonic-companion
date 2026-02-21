# Ableton Harmonic Companion (DAW Musical Companion)

A specialized harmonic assistant for music production. DAW-MC captures live MIDI input, performs real-time harmonic analysis, and offers unified progression building tools with optimized voice leading.

## Features

- **Real-time MIDI Analysis**: Chord detection and modal context inference.
- **Unified Progression Builder**: Drag-and-drop candidates from Functional, Modal, Voicings, and Interval Stack groups.
- **Real-time MIDI Playback**: Route progressions to any MIDI output device (e.g., loopMIDI).
- **Voice Leading Engine**: Suggestions are weighted by voice leading cost for smoother transitions.
- **Harmonic Help Guide**: Integrated documetation for music theory concepts.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.x
- [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (Recommended for Windows)

## Setup for Ableton Live

1. **Install loopMIDI**: Create a virtual port named "DAW-MC Bridge".
2. **App Setup**:
   - Select your physical MIDI controller in the **MIDI Input** dropdown.
   - Select "DAW-MC Bridge" in the **MIDI Out** dropdown.
3. **Ableton Setup**:
   - Create a MIDI track with an instrument.
   - Set **MIDI From** to **All Ins** (or specifically "DAW-MC Bridge").
   - Ensure **Monitor** is set to **In** or **Auto** (and track is armed).
4. **Build & Play**: Drag chords into the progression builder and press **Play**. DAW-MC will drive the Ableton instrument on Channel 1.

## Getting Started

```bash
git clone https://github.com/Sa-Ma-Da/daw-mc.git
cd daw-mc
npm install
npm start
```

## License

ISC
