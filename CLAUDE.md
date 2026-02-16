# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ableton Harmonic Companion is an Electron desktop application for MIDI input ingestion and chord detection. Currently in Phase 1: MIDI ingestion with device selection, active note display, and event logging.

## Commands

- **Run the app:** `npm start` (runs `electron .`)
- **Install dependencies:** `npm install`
- **No test framework, linter, or build step configured yet.**

## Architecture

**Stack:** Electron 40.x, vanilla JavaScript (CommonJS), no bundler.

**Process model:**
- `src/main.js` — Electron main process. Creates BrowserWindow, enables Web MIDI via command-line switches, auto-grants MIDI permissions, handles IPC for DevTools toggle.
- `src/renderer.js` — Renderer process (loaded by `index.html`). Manages UI: device selector dropdown, active notes display, activity log. Instantiates MidiManager and wires up event listeners.
- `src/midi-manager.js` — `MidiManager extends EventEmitter`. Handles MIDI access, device enumeration, input selection, and message parsing. Emits `'note-on'`, `'note-off'`, `'state-change'` events. Tracks active notes in a Set.
- `src/note-utils.js` — `midiToNoteName(midiNumber)` converts MIDI note numbers (0-127) to scientific pitch notation (e.g., MIDI 60 → "C4").
- `index.html` — Single-page UI with dark theme. Sections: device selector, active notes display, activity log, debug panel.

**Security config (dev-mode):** `nodeIntegration: true`, `contextIsolation: false`. Renderer uses `require()` directly.

**Test files:** `test-midi-detection.js` and `test.html` are standalone scripts for validating MIDI device detection via a hidden BrowserWindow — not a test suite.
