# DAW Musical Companion

A specialized harmonic assistant for music production and composition. **DAW Musical Companion** captures live MIDI input, performs real-time harmonic analysis, and offers unified progression building tools with optimized voice leading.

![UI Overview](https://raw.githubusercontent.com/Sa-Ma-Da/ableton-harmonic-companion/main/assets/ui-preview.png)

## Features

- **Real-time MIDI Analysis**: Instant chord detection and modal context inference.
- **Unified Progression Builder**: Drag-and-drop candidates from Functional, Modal, Voicings, and Interval Stack groups.
- **Dynamic Suggestions**: AI-driven harmonic paths tailored to your current playing.
- **Voice Leading Engine**: Suggestions are weighted by "playability" cost for smooth, professional transitions.
- **Real-time MIDI Playback**: Route progressions to any MIDI output device (e.g., loopMIDI, virtual ports).
- **Integrated Help Guide**: Interactive documentation for music theory concepts.

## 🎼 How the "Suggested Next Chord" Works
The Companion doesn't just look at notes; it understands musical "flow" through a multi-stage logic engine:

1.  **Harmonic Context**: As you play, the app tracks your chord history to determine your **Home Key**.
2.  **Functional Scoring**: It prioritizes chords that have a strong "job" in that key. For example, if you are in C Major and just played an F (IV chord), the engine knows that a G (V chord) provides a strong build to resolve back to C.
3.  **Voice Leading (Playability)**: The engine calculates the distance your fingers would move. It ranks suggestions higher if they require **minimal movement** (stepwise motion), helping you find the smoothest transitions between chords.
4.  **Variety & Memory**: To prevent static loops, the engine tracks your last 3–8 chords and applies a "stagnation penalty" to chords you've used too recently, encouraging exploration.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20.x
- [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html) (Recommended for Windows virtual routing)

## Quick Setup (Ableton Live)

1.  **Virtual Port**: Create a virtual port in loopMIDI named "DAW-MC Bridge".
2.  **Companion Config**: Select your MIDI controller as **Input** and "DAW-MC Bridge" as **Output**.
3.  **Ableton Config**: Set a MIDI track's **MIDI From** to "DAW-MC Bridge" and set **Monitor** to **In**.
4.  **Play**: Drag suggested chords into the builder and press **Play** to drive your Ableton instruments.

## Installation

```bash
git clone https://github.com/Sa-Ma-Da/ableton-harmonic-companion.git
cd ableton-harmonic-companion
npm install
npm run launch
```

## License

ISC
