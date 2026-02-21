# Recent Changes Summary (Debug Aid)

## Core Features Implemented
1.  **Key Detection (`src/key-detector.js`)**:
    -   Implemented a class `KeyDetector` that analyzes a rolling history of chords.
    -   Key inference logic based on diatonic scale matching (Major/Minor).
    -   Weighted scoring system: (+1) for scale fit, (+0.15) for Tonic resolution (root match).
    -   Debounced display updates (150ms).

2.  **MidiManager (`src/midi-manager.js`)**:
    -   Refactored initialization to handle `navigator.requestMIDIAccess`.
    -   Added `activeNotes` (Set) to track Note On/Off state.
    -   **Recent Fix**: Safeguarded `document` access inside `init()` to prevent crashes in non-browser environments (Jest). This was the root cause of integration test failures.

3.  **Renderer Logic (`src/renderer.js`)**:
    -   Integrated `KeyDetector` into the analysis loop.
    -   Added `updateAnalysis()` function with debounce logic (`setTimeout`).
    -   Updated UI to show detected Key alongside Chord.
    -   Added manual "Refresh" button for MIDI devices.

4.  **Tests**:
    -   `tests/key-detector.test.js`: Validates key inference logic (e.g., ii-V-I progressions).
    -   `tests/integration.test.js`: Validates `MidiManager` event flow and state tracking.
    -   `tests/simulation.test.js`: Full workflow simulation (currently skipped due to JSDOM environment).

## Known Issues (Current State)
-   **MIDI Dropdown Empty**: The `<select>` element is not populating. This suggests `MidiManager.getInputs()` returns empty, or `updateDeviceList()` is never called.
-   **Unresponsive UI**: "Refresh" and "Debug" buttons do not work. This implies `renderer.js` might be failing silently before attaching event listeners.
-   **Electron Output**: `npm start` shows permission denials for `media`, though MIDI should be allowed.

## File Contents for Reference

### src/midi-manager.js
```javascript
// ... (content of midi-manager.js)
```

### src/renderer.js
```javascript
// ... (content of renderer.js)
```
