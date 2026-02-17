console.log("Renderer script started loading...");
const path = require('path');

// In Electron <script> tags, __dirname resolves to the HTML file's directory (project root),
// NOT the script file's directory (src/). Detect and adjust.
const srcDir = __dirname.endsWith('src') ? __dirname : path.join(__dirname, 'src');

const MidiManager = require(path.join(srcDir, 'midi-manager.js'));
const { detectChord } = require(path.join(srcDir, 'harmonic-analyzer.js'));
const { midiToNoteName } = require(path.join(srcDir, 'note-utils.js'));
const KeyDetector = require(path.join(srcDir, 'key-detector.js'));
const { suggestDiatonicChords, suggestScales, suggestExtensions, suggestIntervals, getChordMetadata } = require(path.join(srcDir, 'suggestion-engine.js'));

console.log('[Renderer] All modules loaded.');

// ---- All DOM access and init wrapped in DOMContentLoaded ----
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Renderer] DOM ready, initializing...');

    const ui = {
        select: document.getElementById('midiInputSelect'),
        refreshBtn: document.getElementById('refreshMidiBtn'),
        activeNotes: document.getElementById('activeNotesDisplay'),
        chordDisplay: document.getElementById('chordDisplay'),
        keyDisplay: document.getElementById('keyDisplay'),
        log: document.getElementById('midiLog'),
        debugSection: document.getElementById('debugSection'),
        toggleDebugBtn: document.getElementById('toggleDebugBtn'),
        chordSuggestions: document.getElementById('chord-suggestions'),
        scaleSuggestions: document.getElementById('scale-suggestions'),
        extensionSuggestions: document.getElementById('extension-suggestions'),
        logLimitInput: document.getElementById('logLimitInput'),
        logPauseBtn: document.getElementById('logPauseBtn'),
        suggestionDetail: document.getElementById('suggestion-detail')
    };

    const midiManager = new MidiManager();
    const keyDetector = new KeyDetector();

    // ---- Persistent Suggestion State ----
    let lastValidChord = null;
    let lastValidKey = null;
    let lastSuggestions = {
        chord: [],
        scale: [],
        extension: [],
        interval: []
    };

    // ---- Log Feed State ----
    let logEntries = [];       // Full cached backlog
    let logDisplayLimit = 50;  // Default display limit
    let logPaused = false;     // Pause/resume state

    // ---- Logging ----
    function logMessage(msg) {
        if (!ui.log) return;
        const text = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logEntries.unshift(text); // Always cache

        if (!logPaused) {
            renderLogFeed();
        }
    }

    function renderLogFeed() {
        if (!ui.log) return;
        const visible = logEntries.slice(0, logDisplayLimit);
        ui.log.innerHTML = '';
        for (const text of visible) {
            const entry = document.createElement('div');
            entry.textContent = text;
            entry.style.borderBottom = '1px solid #333';
            entry.style.padding = '2px 0';
            ui.log.appendChild(entry);
        }
    }

    // ---- Log Controls ----
    if (ui.logLimitInput) {
        ui.logLimitInput.addEventListener('change', () => {
            const val = parseInt(ui.logLimitInput.value, 10);
            if (!isNaN(val) && val > 0) {
                logDisplayLimit = val;
                if (!logPaused) renderLogFeed();
            }
        });
    }

    if (ui.logPauseBtn) {
        ui.logPauseBtn.addEventListener('click', () => {
            logPaused = !logPaused;
            ui.logPauseBtn.textContent = logPaused ? 'Resume Feed' : 'Pause Feed';
            ui.logPauseBtn.style.background = logPaused ? '#553300' : '#444';
            if (!logPaused) renderLogFeed();
        });
    }

    // ---- MIDI Init ----
    async function initializeMidi() {
        logMessage('Requesting MIDI access...');
        const success = await midiManager.init();
        if (success) {
            logMessage('MIDI access granted. Scanning devices...');
            updateDeviceList();

            midiManager.removeAllListeners('state-change');
            midiManager.removeAllListeners('note-on');
            midiManager.removeAllListeners('note-off');

            midiManager.on('state-change', (e) => {
                logMessage(`State Change: ${e.port.name} (${e.port.state})`);
                updateDeviceList();
            });

            midiManager.on('note-on', handleNoteEvent);
            midiManager.on('note-off', handleNoteEvent);
            logMessage('MIDI listeners attached.');
        } else {
            logMessage('ERROR: MIDI access failed!');
            const option = document.createElement('option');
            option.text = "MIDI Access Failed";
            ui.select.add(option);
            ui.select.disabled = true;
        }
    }

    // ---- Device List ----
    function updateDeviceList() {
        const inputs = midiManager.getInputs();
        const currentSelection = ui.select.value;
        ui.select.innerHTML = '';

        if (inputs.length === 0) {
            const option = document.createElement('option');
            option.text = "No MIDI Devices Found";
            ui.select.add(option);
            logMessage('No MIDI devices detected. Connect a device and click Refresh.');
            return;
        }

        logMessage(`Found ${inputs.length} MIDI device(s).`);

        const defaultOption = document.createElement('option');
        defaultOption.text = "Select MIDI Device";
        defaultOption.value = "";
        ui.select.add(defaultOption);

        inputs.forEach(input => {
            const option = document.createElement('option');
            option.value = input.id;
            option.text = input.name;
            ui.select.add(option);
        });

        if (currentSelection && inputs.find(i => i.id === currentSelection)) {
            ui.select.value = currentSelection;
        }

        const debugContainer = document.getElementById('debugDeviceList');
        if (debugContainer) {
            debugContainer.textContent = inputs.map(i => `[${i.id}] ${i.name} (${i.state})`).join('\n');
        }
    }

    // ---- Device Selection ----
    ui.select.addEventListener('change', (e) => {
        if (e.target.value) {
            midiManager.setInput(e.target.value);
            logMessage(`Selected input: ${midiManager.activeInput.name}`);
            updateAnalysis();
        }
    });

    // ---- Refresh Button ----
    ui.refreshBtn.addEventListener('click', () => {
        logMessage('Refreshing MIDI devices...');
        initializeMidi();
    });

    // ---- Debug Toggle ----
    ui.toggleDebugBtn.addEventListener('click', () => {
        const isHidden = ui.debugSection.style.display === 'none';
        ui.debugSection.style.display = isHidden ? 'block' : 'none';
        ui.toggleDebugBtn.textContent = isHidden ? 'Hide Debug' : 'Show Debug';
    });

    // ---- Suggestion Detail Tooltip ----
    function showSuggestionDetail(el, html) {
        if (!ui.suggestionDetail) return;
        const rect = el.getBoundingClientRect();
        ui.suggestionDetail.innerHTML = html;
        ui.suggestionDetail.style.display = 'block';
        ui.suggestionDetail.style.left = `${rect.left}px`;
        ui.suggestionDetail.style.top = `${rect.bottom + 6}px`;
    }

    function hideSuggestionDetail() {
        if (ui.suggestionDetail) {
            ui.suggestionDetail.style.display = 'none';
        }
    }

    function buildMetadataHTML(chordName) {
        const meta = getChordMetadata(chordName);
        if (!meta) return `<strong>${chordName}</strong><br><span style="color:#888;">No metadata available</span>`;
        return `<strong>${chordName}</strong><br>` +
            `<span style="color:#88bbff;">Notes:</span> ${meta.noteNames.join(' - ')}<br>` +
            `<span style="color:#88bbff;">MIDI:</span> ${meta.midiNotes.join(' - ')}<br>` +
            `<span style="color:#88bbff;">Fingering (RH):</span> ${meta.fingering.join(' - ')}`;
    }

    function attachInteraction(container) {
        if (!container) return;
        container.addEventListener('mouseover', (e) => {
            const chip = e.target.closest('[data-chord]');
            if (chip) showSuggestionDetail(chip, buildMetadataHTML(chip.dataset.chord));
        });
        container.addEventListener('mouseout', (e) => {
            const chip = e.target.closest('[data-chord]');
            if (chip) hideSuggestionDetail();
        });
        container.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-chord]');
            if (chip) {
                const detail = ui.suggestionDetail;
                if (detail && detail.style.display === 'block') {
                    hideSuggestionDetail();
                } else if (chip) {
                    showSuggestionDetail(chip, buildMetadataHTML(chip.dataset.chord));
                }
            }
        });
    }

    // Attach interaction handlers to all suggestion containers
    attachInteraction(ui.chordSuggestions);
    attachInteraction(ui.scaleSuggestions);
    attachInteraction(ui.extensionSuggestions);

    // ---- Note Events ----
    function handleNoteEvent({ note, velocity, channel, type }) {
        console.log(`[Renderer] MIDI Event: ${type} Note: ${note}`);
        updateAnalysis();
        const name = midiToNoteName(note);
        const velStr = velocity > 0 ? ` Vel:${velocity}` : '';
        logMessage(`${type === 'note-on' ? 'Note On' : 'Note Off'}: ${name} (${note})${velStr}`);
    }

    // ---- Analysis (Debounced) ----
    let analysisTimeout = null;
    const ANALYSIS_DEBOUNCE_MS = 50;

    function updateAnalysis() {
        if (analysisTimeout) clearTimeout(analysisTimeout);
        analysisTimeout = setTimeout(() => {
            performAnalysis();
        }, ANALYSIS_DEBOUNCE_MS);
    }

    // ---- Rendering ----
    function renderSuggestions(container, suggestions, accentColor) {
        if (!container) return;
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '\u2014';
            return;
        }
        container.innerHTML = suggestions.map(s => {
            const badge = s.function ? `<span style="color:${accentColor};font-size:0.75em;"> ${s.function}</span>` : '';
            return `<span data-chord="${s.name}" style="display:inline-block;background:#333;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;border:1px solid #444;cursor:pointer;" title="Click for details">${s.name}${badge}</span>`;
        }).join('');
    }

    function renderIntervals(container, intervals) {
        if (!container) return;
        if (!intervals || intervals.length === 0) {
            container.innerHTML = '\u2014';
            return;
        }
        container.innerHTML = intervals.map(s => {
            const chordAttr = s.result !== '\u2014' ? `data-chord="${s.result}"` : '';
            const resultBadge = s.result !== '\u2014' ? `<span style="color:#88cc88;font-size:0.75em;"> \u2192 ${s.result}</span>` : '';
            return `<span ${chordAttr} style="display:inline-block;background:#2a332a;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;border:1px solid #3a4a3a;cursor:pointer;" title="Click for details">${s.name} <span style="color:#888;font-size:0.75em;">${s.interval}</span>${resultBadge}</span>`;
        }).join('');
    }

    // ---- Core Analysis ----
    function performAnalysis() {
        const activeNotes = midiManager.getActiveNotes();

        // No notes active → show cached suggestions or clear
        if (activeNotes.length === 0) {
            ui.activeNotes.innerText = "-";
            ui.activeNotes.style.color = "#555";
            ui.chordDisplay.innerText = lastValidChord || "-";
            ui.chordDisplay.style.color = lastValidChord ? "#997700" : "#555";
            ui.chordDisplay.style.textShadow = "none";

            // Show cached suggestions
            renderSuggestions(ui.chordSuggestions, lastSuggestions.chord, '#66cc66');
            renderSuggestions(ui.scaleSuggestions, lastSuggestions.scale, '#66aacc');
            renderSuggestions(ui.extensionSuggestions, lastSuggestions.extension, '#ccaa66');
            return;
        }

        // Update active notes display
        const noteNames = activeNotes.map(n => midiToNoteName(n)).join("  ");
        ui.activeNotes.innerText = noteNames;
        ui.activeNotes.style.color = "#4db8ff";

        const chordName = detectChord(activeNotes);

        if (chordName) {
            // ---- Valid chord detected: update everything ----
            lastValidChord = chordName;

            keyDetector.addChord(chordName);
            const keys = keyDetector.detect();
            if (keys.length > 0) {
                const bestKey = keys[0];
                lastValidKey = `${bestKey.root} ${bestKey.scale}`;
                ui.keyDisplay.innerText = `Key: ${lastValidKey}`;
                ui.keyDisplay.style.color = "#aaa";
            }

            ui.chordDisplay.innerText = chordName;
            ui.chordDisplay.style.color = "#ffcc00";
            ui.chordDisplay.style.textShadow = "0 0 15px rgba(255, 204, 0, 0.5)";

            // Regenerate and cache all suggestions
            lastSuggestions.chord = suggestDiatonicChords(lastValidKey, chordName);
            lastSuggestions.scale = suggestScales(lastValidKey, chordName);
            lastSuggestions.extension = suggestExtensions(chordName);
            lastSuggestions.interval = [];

            renderSuggestions(ui.chordSuggestions, lastSuggestions.chord, '#66cc66');
            renderSuggestions(ui.scaleSuggestions, lastSuggestions.scale, '#66aacc');
            renderSuggestions(ui.extensionSuggestions, lastSuggestions.extension, '#ccaa66');

        } else if (activeNotes.length >= 2) {
            // ---- 2 notes, no chord yet: show interval suggestions ----
            ui.chordDisplay.innerText = "?";
            ui.chordDisplay.style.color = "#888";
            ui.chordDisplay.style.textShadow = "none";

            const intervalSugs = suggestIntervals(activeNotes);
            lastSuggestions.interval = intervalSugs;

            renderIntervals(ui.extensionSuggestions, intervalSugs);
            // Keep cached chord/scale suggestions visible
            renderSuggestions(ui.chordSuggestions, lastSuggestions.chord, '#66cc66');
            renderSuggestions(ui.scaleSuggestions, lastSuggestions.scale, '#66aacc');

        } else {
            // ---- 1 note: show cached + interval suggestions ----
            ui.chordDisplay.innerText = "?";
            ui.chordDisplay.style.color = "#888";
            ui.chordDisplay.style.textShadow = "none";

            const intervalSugs = suggestIntervals(activeNotes);
            lastSuggestions.interval = intervalSugs;

            renderSuggestions(ui.chordSuggestions, lastSuggestions.chord, '#66cc66');
            renderSuggestions(ui.scaleSuggestions, lastSuggestions.scale, '#66aacc');
            // Show intervals in extension panel when only 1 note
            if (intervalSugs.length > 0) {
                renderIntervals(ui.extensionSuggestions, intervalSugs);
            } else {
                renderSuggestions(ui.extensionSuggestions, lastSuggestions.extension, '#ccaa66');
            }
        }
    }

    // ---- Start ----
    logMessage('App initializing...');
    await initializeMidi();
    logMessage('Init complete.');
});
