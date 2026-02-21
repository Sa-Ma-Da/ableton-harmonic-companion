console.log("Renderer script started loading...");
const path = require('path');
const fs = require('fs');

// In Electron <script> tags, __dirname resolves to the HTML file's directory (project root),
// NOT the script file's directory (src/). Detect and adjust.
const srcDir = __dirname.endsWith('src') ? __dirname : path.join(__dirname, 'src');

const MidiManager = require(path.join(srcDir, 'midi-manager.js'));
const { detectChord } = require(path.join(srcDir, 'harmonic-analyzer.js'));
const { midiToNoteName } = require(path.join(srcDir, 'note-utils.js'));
const KeyDetector = require(path.join(srcDir, 'key-detector.js'));
const { suggestDiatonicChords, suggestScales, suggestExtensions, suggestIntervals, suggestNextChords, getChordMetadata, applyExtension } = require(path.join(srcDir, 'suggestion-engine.js'));
const { exportProgressionToMidi } = require(path.join(srcDir, 'midi-exporter.js'));
const { initMidiOutput, getOutputs, setOutput, playProgression, stopPlayback } = require(path.join(srcDir, 'midi-output.js'));
const { detectModeFromChords, suggestModalNextChords } = require(path.join(srcDir, 'modal-context.js'));
const SCALES = require(path.join(srcDir, 'scale-dictionary.js'));

console.log('[Renderer] All modules loaded.');

// ---- All DOM access and init wrapped in DOMContentLoaded ----
document.addEventListener('DOMContentLoaded', async () => {
    // Forced Branding Proof
    document.title = "DAW Musical Companion";
    console.log('[Renderer] Application Identity: Ableton Harmonic Companion');

    try {
        const ui = {
            select: document.getElementById('midiInputSelect'),
            refreshBtn: document.getElementById('refreshMidiBtn'),
            activeNotes: document.getElementById('activeNotesDisplay'),
            liveChordDisplay: document.getElementById('liveChordDisplay'),
            liveKeyDisplay: document.getElementById('liveKeyDisplay'),
            liveNotesDisplay: document.getElementById('liveNotesDisplay'),
            log: document.getElementById('midiLog'),
            debugSection: document.getElementById('debugSection'),
            toggleDebugBtn: document.getElementById('toggleDebugBtn'),
            logLimitInput: document.getElementById('logLimitInput'),
            logPauseBtn: document.getElementById('logPauseBtn'),
            suggestionDetail: document.getElementById('suggestion-detail'),
            // Unified Candidate Panel
            candidatePanel: document.getElementById('candidatePanel'),
            functionalChords: document.getElementById('functionalChords'),
            modalChords: document.getElementById('modalChords'),
            voicingChords: document.getElementById('voicingChords'),
            intervalChords: document.getElementById('intervalChords'),
            // Help & Backgrounds
            helpToggleBtn: document.getElementById('helpToggleBtn'),
            helpPanel: document.getElementById('helpPanel'),
            bgSelect: document.getElementById('bgSelect'),
            // Playback
            midiOutputSelect: document.getElementById('midiOutputSelect'),
            progressionBpmInput: document.getElementById('progressionBpmInput'),
            playProgressionBtn: document.getElementById('playProgressionBtn'),
            stopProgressionBtn: document.getElementById('stopProgressionBtn'),
            // Progression Builder
            progressionMemoryInput: document.getElementById('progressionMemoryInput'),
            clearProgressionBtn: document.getElementById('clearProgressionBtn'),
            progressionSuggestions: document.getElementById('progression-suggestions'),
            currentProgression: document.getElementById('current-progression'),
            modeLockSelect: document.getElementById('modeLockSelect'),
            modalContextDisplay: document.getElementById('modalContextDisplay'),
            // loopMIDI
            loopMidiBridge: document.getElementById('loopMidiBridge'),
            launchLoopMidiBtn: document.getElementById('launchLoopMidiBtn'),
            loopMidiStatus: document.getElementById('loopMidiStatus'),
            // Version footer
            versionFooter: document.getElementById('version-footer'),
            // MIDI Export
            exportMidiBtn: document.getElementById('exportMidiBtn'),
            beatsPerChordSelect: document.getElementById('beatsPerChordSelect'),
            registerSelect: document.getElementById('registerSelect'),
            voicingStyleSelect: document.getElementById('voicingStyleSelect'),
            progressionBankSelect: document.getElementById('progressionBankSelect')
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

        // ---- Progression Builder State ----
        let chordHistory = [];
        const progressionBanks = { A: [], B: [], C: [], D: [] };
        const bankLockState = { A: false, B: false, C: false, D: false };
        const bankSeedState = { A: true, B: true, C: true, D: true };

        // ---- Backgrounds & Help ----
        let previewActive = true;

        function initBackgroundSelector() {
            const savedBg = localStorage.getItem('backgroundStyle') || 'Calendar';
            applyBackground(savedBg);

            if (ui.bgSelect) {
                ui.bgSelect.value = savedBg;
                ui.bgSelect.addEventListener('change', () => {
                    const bg = ui.bgSelect.value;
                    applyBackground(bg);
                    localStorage.setItem('backgroundStyle', bg);
                });
            }
        }
        function applyBackground(bg) {
            // Clear all background classes
            document.body.classList.remove('background-calendar', 'background-ambient', 'background-studio');

            if (bg === 'Calendar') {
                document.body.classList.add('background-calendar');
            } else if (bg === 'Ambient') {
                document.body.classList.add('background-ambient');
            } else if (bg === 'Studio') {
                document.body.classList.add('background-studio');
            } else {
                // None or default
                document.body.style.backgroundColor = '#111';
            }
        }

        // ---- MIDI Output ----
        async function setupMidiOutput() {
            if (!ui.midiOutputSelect) return;

            const success = await initMidiOutput();
            if (success) {
                const outputs = getOutputs();
                outputs.forEach(out => {
                    const opt = document.createElement('option');
                    opt.value = out.id;
                    opt.text = out.name;
                    ui.midiOutputSelect.add(opt);
                });

                // Restore selection
                const savedOut = localStorage.getItem('selectedMidiOutput');
                if (savedOut && outputs.find(o => o.id === savedOut)) {
                    ui.midiOutputSelect.value = savedOut;
                    setOutput(savedOut);
                }

                ui.midiOutputSelect.addEventListener('change', e => {
                    setOutput(e.target.value);
                    localStorage.setItem('selectedMidiOutput', e.target.value);
                });
            }
        }

        // ---- Playback Handlers ----
        ui.playProgressionBtn.addEventListener('click', () => {
            const prog = progressionBanks[activeBank]; // Current bank
            const bpm = parseInt(ui.progressionBpmInput.value) || 120;
            const beats = parseInt(ui.beatsPerChordSelect.value) || 4;
            const register = ui.registerSelect.value;
            const voicingStyle = ui.voicingStyleSelect.value; // Playback engine uses register for octave, but style?
            // User request didn't specify style for playback, just "Use getChordMetadata".
            // But `midi-output.js` `playProgression` accepts (progression, bpm, beatsPerChord, register).
            // It implements rudimentary voicing.

            playProgression(prog, bpm, beats, register, () => {
                console.log('[Renderer] Playback complete');
            });
        });

        ui.stopProgressionBtn.addEventListener('click', () => {
            stopPlayback();
        });

        // Call Inits
        setupMidiOutput();
        let activeBank = 'A';
        let progressionMemoryLength = 3;
        let modeLockValue = 'Auto';

        // ---- Log Feed State ----
        let logEntries = [];       // Full cached backlog
        let logDisplayLimit = 50;  // Default display limit
        let logPaused = false;     // Pause/resume state

        // ---- Version Display ----
        try {
            const rootDir = __dirname.endsWith('src') ? path.join(__dirname, '..') : __dirname;
            const versionData = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf8'));
            if (ui.versionFooter) ui.versionFooter.textContent = `v${versionData.version}`;
        } catch {
            if (ui.versionFooter) ui.versionFooter.textContent = 'v—';
        }

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

                // loopMIDI detection
                detectLoopMidi();
            } else {
                logMessage('ERROR: MIDI access failed!');
                const option = document.createElement('option');
                option.text = "MIDI Access Failed";
                ui.select.add(option);
                ui.select.disabled = true;
            }
        }

        // ---- loopMIDI Detection ----
        function detectLoopMidi() {
            const inputs = midiManager.getInputs();
            const hasLoopMidi = inputs.some(i => i.name && i.name.toLowerCase().includes('loopmidi'));
            if (ui.loopMidiBridge) {
                ui.loopMidiBridge.style.display = hasLoopMidi ? 'none' : 'flex';
            }
        }

        if (ui.launchLoopMidiBtn) {
            ui.launchLoopMidiBtn.addEventListener('click', () => {
                try {
                    const { ipcRenderer } = require('electron');
                    ipcRenderer.send('launch-loopmidi');
                    if (ui.loopMidiStatus) ui.loopMidiStatus.textContent = 'Launching...';

                    ipcRenderer.once('loopmidi-status', (event, status) => {
                        if (status.running) {
                            if (ui.loopMidiStatus) ui.loopMidiStatus.textContent = 'Launched!';
                            logMessage('loopMIDI launched successfully.');
                            setTimeout(() => detectLoopMidi(), 2000);
                        } else {
                            if (ui.loopMidiStatus) ui.loopMidiStatus.textContent = status.error || 'Launch failed';
                            logMessage(`loopMIDI: ${status.error || 'Launch failed'}`);
                        }
                    });
                } catch (err) {
                    if (ui.loopMidiStatus) ui.loopMidiStatus.textContent = 'Error: ' + err.message;
                }
            });
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

            // Restore selection: prefer current in-session selection, then localStorage
            const savedDevice = localStorage.getItem('lastMidiDevice');
            if (currentSelection && inputs.find(i => i.id === currentSelection)) {
                ui.select.value = currentSelection;
            } else if (savedDevice && inputs.find(i => i.id === savedDevice)) {
                ui.select.value = savedDevice;
                midiManager.setInput(savedDevice);
                logMessage(`Auto-selected saved device: ${midiManager.activeInput ? midiManager.activeInput.name : savedDevice}`);
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
                localStorage.setItem('lastMidiDevice', e.target.value);
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
            if (!previewActive) return;
            if (!ui.suggestionDetail) return;

            // Trigger stateless preview if metadata is available
            const chordName = el.dataset.chord;
            if (chordName) {
                const meta = getChordMetadata(chordName);
                if (meta && meta.midiNotes) {
                    previewChordVoicing(meta.midiNotes);
                }
            }

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
            container.querySelectorAll('[data-chord]').forEach(chip => {
                chip.addEventListener('mouseover', () => {
                    showSuggestionDetail(chip, buildMetadataHTML(chip.dataset.chord));
                });
                chip.addEventListener('mouseout', () => {
                    hideSuggestionDetail();
                });
            });
        }

        function clearHoverPreview() {
            previewActive = true;
            hideSuggestionDetail();
        }

        // Attach interaction handlers to unified candidate containers
        attachInteraction(ui.candidateChords);
        attachInteraction(ui.candidateScales);
        attachInteraction(ui.candidateExtensions);

        // ---- Progression Builder Controls ----
        if (ui.progressionMemoryInput) {
            ui.progressionMemoryInput.addEventListener('change', () => {
                const val = parseInt(ui.progressionMemoryInput.value, 10);
                if (!isNaN(val) && val >= 1) {
                    progressionMemoryLength = val;
                    updateProgressionSuggestions();
                }
            });
        }

        if (ui.clearProgressionBtn) {
            ui.clearProgressionBtn.addEventListener('click', () => {
                progressionBanks[activeBank] = [];
                bankLockState[activeBank] = false;
                bankSeedState[activeBank] = true;
                renderCurrentProgression();
                updateProgressionSuggestions();
            });
        }

        // Progression suggestion click → append to current progression
        if (ui.progressionSuggestions) {
            ui.progressionSuggestions.addEventListener('mouseover', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip) showSuggestionDetail(chip, buildMetadataHTML(chip.dataset.chord));
            });
            ui.progressionSuggestions.addEventListener('mouseout', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip) hideSuggestionDetail();
            });
            ui.progressionSuggestions.addEventListener('click', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip && chip.dataset.chord) {
                    clearHoverPreview();
                    progressionBanks[activeBank].push(chip.dataset.chord);
                    bankLockState[activeBank] = true;
                    bankSeedState[activeBank] = false;
                    renderCurrentProgression();
                    updateProgressionSuggestions();
                }
            });
        }

        // Current progression click → remove chord
        if (ui.currentProgression) {
            ui.currentProgression.addEventListener('mouseover', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip) showSuggestionDetail(chip, buildMetadataHTML(chip.dataset.chord));
            });
            ui.currentProgression.addEventListener('mouseout', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip) hideSuggestionDetail();
            });
            ui.currentProgression.addEventListener('click', (e) => {
                const chip = e.target.closest('[data-prog-index]');
                if (chip) {
                    clearHoverPreview();
                    const index = parseInt(chip.dataset.progIndex, 10);
                    // Clicking the first chord while dynamic → lock it
                    if (index === 0 && bankSeedState[activeBank] && !bankLockState[activeBank] && progressionBanks[activeBank].length === 1) {
                        bankLockState[activeBank] = true;
                        bankSeedState[activeBank] = false;
                        logMessage(`Progression locked at: ${progressionBanks[activeBank][0]}`);
                        renderCurrentProgression();
                        updateProgressionSuggestions();
                    } else {
                        // Normal remove behavior for locked progressions
                        progressionBanks[activeBank].splice(index, 1);
                        renderCurrentProgression();
                        updateProgressionSuggestions();
                    }
                }
            });
        }

        function updateProgressionSuggestions() {
            if (!ui.progressionSuggestions) return;

            // Use current progression if it has entries, else use chord history
            const sourceHistory = progressionBanks[activeBank].length > 0 ? progressionBanks[activeBank] : chordHistory;

            if (sourceHistory.length === 0 || !lastValidKey) {
                ui.progressionSuggestions.innerHTML = '\u2014';
                return;
            }

            const suggestions = suggestNextChords(sourceHistory, lastValidKey, progressionMemoryLength);
            if (!suggestions || suggestions.length === 0) {
                ui.progressionSuggestions.innerHTML = '\u2014';
                return;
            }

            ui.progressionSuggestions.innerHTML = suggestions.map(s => {
                const badge = s.function ? `<span style="color:#bb88ff;font-size:0.75em;"> ${s.function}</span>` : '';
                const conf = s.confidence ? `<span style="color:#666;font-size:0.65em;"> ${Math.round(s.confidence * 100)}%</span>` : '';
                return `<span data-chord="${s.name}" draggable="true" data-drag-type="chord" style="display:inline-block;background:#2a2a3a;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;border:1px solid #3a3a4a;cursor:grab;" title="Drag to slot or click to add">${s.name}${badge}${conf}</span>`;
            }).join('');

            // Make progression suggestion chips draggable
            ui.progressionSuggestions.querySelectorAll('[data-chord]').forEach(chip => {
                chip.addEventListener('dragstart', (e) => {
                    previewActive = false;
                    hideSuggestionDetail();
                    e.dataTransfer.setData('text/chord', chip.dataset.chord);
                    e.dataTransfer.setData('text/drag-type', 'chord');
                });
            });
        }

        function renderCurrentProgression() {
            if (!ui.currentProgression) return;

            if (progressionBanks[activeBank].length === 0) {
                ui.currentProgression.innerHTML = '\u2014';
                return;
            }

            ui.currentProgression.innerHTML = progressionBanks[activeBank].map((chord, i) => {
                const sep = i < progressionBanks[activeBank].length - 1 ? ' <span style="color:#555;">→</span> ' : '';
                return `<span data-chord="${chord}" data-prog-index="${i}" data-slot-index="${i}" class="progression-slot" style="display:inline-block;background:#2a223a;padding:2px 8px;border-radius:4px;margin:2px 2px;border:1px solid #3a2a4a;cursor:pointer;transition:border-color 0.2s;" title="Click to remove · Drop chord to replace · Drop extension to transform">${chord}</span>${sep}`;
            }).join('');

            // Attach drop target handlers to each slot
            ui.currentProgression.querySelectorAll('.progression-slot').forEach(slot => {
                slot.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    slot.style.borderColor = '#8866cc';
                    slot.style.background = '#3a2a5a';
                });
                slot.addEventListener('dragleave', () => {
                    slot.style.borderColor = '#3a2a4a';
                    slot.style.background = '#2a223a';
                });
                slot.addEventListener('drop', (e) => {
                    e.preventDefault();
                    slot.style.borderColor = '#3a2a4a';
                    slot.style.background = '#2a223a';
                    previewActive = true;
                    clearHoverPreview();

                    const slotIndex = parseInt(slot.dataset.slotIndex, 10);
                    const dragType = e.dataTransfer.getData('text/drag-type');
                    const chordName = e.dataTransfer.getData('text/chord');

                    if (dragType === 'voicing' || dragType === 'extension') {
                        // Voicing drop → apply to slot
                        const extType = e.dataTransfer.getData('text/extension-type') || chordName.split(' ')[1];
                        const baseChord = progressionBanks[activeBank][slotIndex];
                        const transformed = applyExtension(baseChord, extType);
                        if (transformed) {
                            progressionBanks[activeBank][slotIndex] = transformed;
                            logMessage(`Slot ${slotIndex}: Applied Voicing ${extType} → ${transformed}`);
                        }
                    } else if (dragType === 'interval') {
                        // Interval drop → apply stack/result
                        if (chordName) {
                            progressionBanks[activeBank][slotIndex] = chordName;
                            logMessage(`Slot ${slotIndex}: Applied Interval Stack → ${chordName}`);
                        }
                    } else {
                        // Functional/Modal chord drop → replace slot
                        if (chordName) {
                            progressionBanks[activeBank][slotIndex] = chordName;
                            bankLockState[activeBank] = true;
                            bankSeedState[activeBank] = false;
                            logMessage(`Slot ${slotIndex} replaced with ${chordName}`);
                        }
                    }

                    renderCurrentProgression();
                    updateProgressionSuggestions();
                });
            });

            // Attach handlers to Append Target
            const appendTarget = document.getElementById('progressionAppendTarget');
            if (appendTarget) {
                appendTarget.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    appendTarget.classList.add('drag-over');
                });
                appendTarget.addEventListener('dragleave', () => {
                    appendTarget.classList.remove('drag-over');
                });
                appendTarget.addEventListener('drop', (e) => {
                    e.preventDefault();
                    appendTarget.classList.remove('drag-over');
                    previewActive = true;
                    clearHoverPreview();

                    const chordName = e.dataTransfer.getData('text/chord');
                    const dragType = e.dataTransfer.getData('text/drag-type');
                    const extType = e.dataTransfer.getData('text/extension-type');

                    appendCandidateToProgression({
                        name: chordName,
                        type: dragType,
                        extension: extType
                    });
                });
                appendTarget.addEventListener('click', () => {
                    if (lastValidChord) {
                        appendCandidateToProgression({
                            name: lastValidChord,
                            type: 'functional'
                        });
                    }
                });
            }
        }

        function appendCandidateToProgression(candidate) {
            const bank = progressionBanks[activeBank];
            const { type, name, extension } = candidate;

            if (type === 'voicing' || type === 'interval' || type === 'extension') {
                if (bank.length === 0) {
                    // CONTRACT-34: Fallback to base chord from detected tonic or C if empty
                    const root = lastModalContext ? lastModalContext.tonic : 'C';
                    const quality = extension && extension.includes('Maj') ? 'Major' : 'Major';
                    const fallback = `${root} ${quality}`;
                    bank.push(fallback);
                    logMessage(`Progression empty. Fallback append: ${fallback}`);
                } else {
                    const lastIdx = bank.length - 1;
                    const baseChord = bank[lastIdx];
                    const extType = extension || name.split(' ')[1];
                    const transformed = applyExtension(baseChord, extType);
                    if (transformed) {
                        bank[lastIdx] = transformed;
                        logMessage(`Appended transformation to last slot: ${transformed}`);
                    }
                }
            } else {
                // Functional / Modal -> Append new slot
                if (name) {
                    bank.push(name);
                    bankLockState[activeBank] = true;
                    bankSeedState[activeBank] = false;
                    logMessage(`Appended ${name} to progression`);
                }
            }

            renderCurrentProgression();
            updateProgressionSuggestions();
        }

        // ---- Note Events ----
        function handleNoteEvent({ note, velocity, channel, type }) {
            console.log(`[Renderer] MIDI Event: ${type} Note: ${note}`);
            updateAnalysis();
            const name = midiToNoteName(note);
            const velStr = velocity > 0 ? ` Vel:${velocity}` : '';
            logMessage(`${type === 'note-on' ? 'Note On' : 'Note Off'}: ${name} (${note})${velStr}`);
        }

        // ---- Live Detection Renderer ----
        const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        function renderLiveDetection(chordName) {
            const modeResult = lastModalContext;
            if (!modeResult || !modeResult.tonic || !modeResult.mode) {
                if (ui.liveKeyDisplay) ui.liveKeyDisplay.innerText = `Key: ${lastValidKey || '-'}`;
                if (ui.liveNotesDisplay) ui.liveNotesDisplay.innerText = '-';
                return;
            }

            // Update key display
            const lockIcon = modeLockValue !== 'Auto' ? '\uD83D\uDD12 ' : '';
            if (ui.liveKeyDisplay) {
                ui.liveKeyDisplay.innerText = `${lockIcon}${modeResult.tonic} ${modeResult.mode}`;
            }

            // Compute scale note names from tonic + mode intervals
            const intervals = SCALES[modeResult.mode];
            if (intervals && ui.liveNotesDisplay) {
                const tonicIndex = CHROMATIC_NOTES.indexOf(modeResult.tonic);
                if (tonicIndex >= 0) {
                    const scaleNotes = intervals.map(i => CHROMATIC_NOTES[(tonicIndex + i) % 12]);
                    ui.liveNotesDisplay.innerText = scaleNotes.join(' ');
                } else {
                    ui.liveNotesDisplay.innerText = '-';
                }
            } else if (ui.liveNotesDisplay) {
                ui.liveNotesDisplay.innerText = '-';
            }
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
        function renderSuggestions(container, suggestions, accentColor, options = {}) {
            if (!container) return;
            if (!suggestions || suggestions.length === 0) {
                container.innerHTML = '\u2014';
                return;
            }
            const { draggable = false, dragType = 'chord' } = options;
            container.innerHTML = suggestions.map(s => {
                const badge = s.function ? `<span style="color:${accentColor};font-size:0.75em;"> ${s.function}</span>` : '';
                const dragAttr = draggable ? `draggable="true" data-drag-type="${dragType}"` : '';
                const extAttr = (dragType === 'extension' && s.quality) ? `data-extension-type="${s.quality}"` : '';
                const cursor = draggable ? 'cursor:grab;' : 'cursor:pointer;';
                return `<span data-chord="${s.name}" ${dragAttr} ${extAttr} style="display:inline-block;background:#333;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;border:1px solid #444;${cursor}" title="${draggable ? 'Drag to slot' : 'Click for details'}">${s.name}${badge}</span>`;
            }).join('');

            // Attach drag handlers
            if (draggable) {
                container.querySelectorAll('[draggable]').forEach(chip => {
                    chip.addEventListener('dragstart', (e) => {
                        previewActive = false;
                        hideSuggestionDetail();
                        if (dragType === 'extension') {
                            e.dataTransfer.setData('text/extension-type', chip.dataset.extensionType || '');
                            e.dataTransfer.setData('text/drag-type', 'extension');
                        } else {
                            e.dataTransfer.setData('text/chord', chip.dataset.chord);
                            e.dataTransfer.setData('text/drag-type', 'chord');
                        }
                    });
                });
            }
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
                return `<span ${chordAttr} draggable="true" data-drag-type="chord" style="display:inline-block;background:#2a332a;padding:2px 8px;border-radius:4px;margin:2px 4px 2px 0;border:1px solid #3a4a3a;cursor:grab;" title="Drag to slot">${s.name} <span style="color:#888;font-size:0.75em;">${s.interval}</span>${resultBadge}</span>`;
            }).join('');

            // Attach drag handlers for intervals
            container.querySelectorAll('[draggable]').forEach(chip => {
                chip.addEventListener('dragstart', (e) => {
                    previewActive = false;
                    hideSuggestionDetail();
                    e.dataTransfer.setData('text/chord', chip.dataset.chord || '');
                    e.dataTransfer.setData('text/drag-type', 'chord');
                });
            });
        }

        // ---- Core Analysis ----
        function performAnalysis() {
            const activeNotes = midiManager.getActiveNotes();

            // No notes active → show cached suggestions or clear
            if (activeNotes.length === 0) {
                ui.activeNotes.innerText = "-";
                ui.activeNotes.style.color = "#555";
                ui.liveChordDisplay.innerText = lastValidChord || "-";
                ui.liveChordDisplay.style.color = lastValidChord ? "#997700" : "#555";
                ui.liveChordDisplay.style.textShadow = "none";

                // Show cached suggestions in candidate panel
                renderCandidatePanel();
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

                // Push to chord history for progression builder
                if (chordHistory.length === 0 || chordHistory[chordHistory.length - 1] !== chordName) {
                    chordHistory.push(chordName);
                }

                // Progression lifecycle: EMPTY → DYNAMIC_FIRST → LOCKED
                if (progressionBanks[activeBank].length === 0) {
                    // EMPTY → DYNAMIC_FIRST
                    progressionBanks[activeBank].push(chordName);
                    bankSeedState[activeBank] = true;
                    bankLockState[activeBank] = false;
                    renderCurrentProgression();
                } else if (bankSeedState[activeBank] && !bankLockState[activeBank] && progressionBanks[activeBank].length === 1) {
                    // DYNAMIC_FIRST: replace first chord live
                    progressionBanks[activeBank][0] = chordName;
                    renderCurrentProgression();
                }
                // LOCKED: do NOT overwrite progression[0]

                keyDetector.addChord(chordName);
                const keys = keyDetector.detect();
                if (keys.length > 0) {
                    const bestKey = keys[0];
                    lastValidKey = `${bestKey.root} ${bestKey.scale}`;
                }

                ui.liveChordDisplay.innerText = chordName;
                ui.liveChordDisplay.style.color = "#ffcc00";
                ui.liveChordDisplay.style.textShadow = "0 0 15px rgba(255, 204, 0, 0.5)";

                // Regenerate and cache all suggestions
                lastSuggestions.chord = suggestDiatonicChords(lastValidKey, chordName);
                lastSuggestions.scale = suggestScales(lastValidKey, chordName);
                lastSuggestions.extension = suggestExtensions(chordName);
                lastSuggestions.interval = [];

                renderCandidatePanel();

                // Update progression suggestions
                updateProgressionSuggestions();

                // Update modal context + live detection
                updateModalContext(chordName);
                renderLiveDetection(chordName);

            } else if (activeNotes.length >= 2) {
                // ---- 2 notes, no chord yet: show interval suggestions ----
                ui.liveChordDisplay.innerText = "?";
                ui.liveChordDisplay.style.color = "#888";
                ui.liveChordDisplay.style.textShadow = "none";

                const intervalSugs = suggestIntervals(activeNotes);
                lastSuggestions.interval = intervalSugs;

                renderCandidatePanel(intervalSugs);

            } else {
                // ---- 1 note: show cached + interval suggestions ----
                ui.liveChordDisplay.innerText = "?";
                ui.liveChordDisplay.style.color = "#888";
                ui.liveChordDisplay.style.textShadow = "none";

                const noteNames2 = activeNotes.map(n => midiToNoteName(n)).join("  ");
                ui.activeNotes.innerText = noteNames2;
                ui.activeNotes.style.color = "#4db8ff";

                const intervalSugs = suggestIntervals(activeNotes);
                lastSuggestions.interval = intervalSugs;

                renderCandidatePanel(intervalSugs);
            }
        }

        // ---- MIDI Export Handler ----
        if (ui.exportMidiBtn) {
            ui.exportMidiBtn.addEventListener('click', async () => {
                if (progressionBanks[activeBank].length === 0) {
                    logMessage('Nothing to export — build a progression first.');
                    return;
                }

                const beatsPerChord = parseInt(ui.beatsPerChordSelect?.value || '2', 10);
                const register = ui.registerSelect?.value || 'Mid';
                const voicingStyle = ui.voicingStyleSelect?.value || 'Triad';

                try {
                    const buffer = exportProgressionToMidi(progressionBanks[activeBank], {
                        bpm: 120,
                        beatsPerChord,
                        velocity: 100,
                        register,
                        voicingStyle
                    });

                    if (buffer.length === 0) {
                        logMessage('Export failed — could not generate MIDI data.');
                        return;
                    }

                    const { ipcRenderer } = require('electron');
                    const result = await ipcRenderer.invoke('save-midi-dialog');

                    if (result.canceled || !result.filePath) {
                        logMessage('Export cancelled.');
                        return;
                    }

                    fs.writeFileSync(result.filePath, Buffer.from(buffer));
                    logMessage(`Exported ${progressionBanks[activeBank].length} chords to ${result.filePath}`);
                } catch (err) {
                    logMessage(`Export error: ${err.message}`);
                }
            });
        }

        // ---- Modal Context ----
        let lastModalContext = null;
        let lastModalSuggestions = [];

        function getEffectiveMode() {
            if (modeLockValue !== 'Auto') {
                // User-locked mode — derive tonic from key if available
                const tonic = lastValidKey ? lastValidKey.split(' ')[0] : 'C';
                return { tonic, mode: modeLockValue, confidence: 1.0 };
            }
            return detectModeFromChords(chordHistory);
        }

        function updateModalContext(chordName) {
            if (!ui.modalContextDisplay) return;

            const modeResult = getEffectiveMode();
            if (!modeResult) {
                lastModalSuggestions = [];
                return;
            }

            lastModalContext = modeResult;

            // Display detected/locked mode
            const confPct = Math.round(modeResult.confidence * 100);
            const lockIcon = modeLockValue !== 'Auto' ? '🔒 ' : '';
            ui.modalContextDisplay.innerHTML =
                `${lockIcon}<span style="color:#bb99ee;font-weight:bold;">${modeResult.tonic} ${modeResult.mode}</span>` +
                `<span style="color:#666;margin-left:8px;">(${confPct}%)</span>`;

            // Cache modal suggestions for candidate panel
            lastModalSuggestions = suggestModalNextChords(modeResult.mode, modeResult.tonic, chordName);
        }

        // ---- Unified Candidate Panel Renderer ----
        // ---- Unified Candidate Panel Renderer ----
        function renderCandidatePanel(intervalOverrides) {
            // Collect all candidates into a single map to deduplicate by name
            const candidateMap = new Map();

            // Helper to add candidates with source priority (diatonic > modal > interval > extension)
            const addCandidates = (list, source, defaultConf) => {
                if (!list) return;
                for (const s of list) {
                    const name = s.name;
                    const existing = candidateMap.get(name);

                    // Merge/Overwrite logic
                    const newConf = s.confidence !== undefined ? s.confidence : defaultConf;
                    const oldConf = existing ? (existing.confidence !== undefined ? existing.confidence : 0) : -1;

                    if (!existing || newConf > oldConf) {
                        candidateMap.set(name, { ...s, source, confidence: newConf });
                    }
                }
            };

            addCandidates(lastSuggestions.chord, 'functional', 0.5);
            addCandidates(lastModalSuggestions, 'modal', 0.6);

            // Interval suggestions
            const intList = intervalOverrides || lastSuggestions.interval || [];
            // Interval results are strings "C Major" stored in .result, need to normalize
            const normalizedIntervals = intList
                .filter(i => i.result && i.result !== '—')
                .map(i => ({ name: i.result, function: `via ${i.interval}`, confidence: 0.45 }));
            addCandidates(normalizedIntervals, 'interval', 0.45);

            // Extensions (treat as "Voicing" candidates if they are modifiers, or full chords)
            addCandidates(lastSuggestions.extension, 'voicing', 0.4);

            // Grouping
            const groups = {
                functional: [],
                modal: [],
                voicing: [],
                interval: []
            };

            candidateMap.forEach(chord => {
                const name = chord.name;
                // Priority categorization logic from requirements
                if (name.includes('Sus') || name.includes('5')) {
                    groups.interval.push(chord);
                } else if (name.includes('add') || name.includes('no')) {
                    groups.voicing.push(chord);
                } else if (chord.source === 'modal') {
                    groups.modal.push(chord);
                } else {
                    groups.functional.push(chord);
                }
            });

            // Render each group
            const renderGroup = (container, list, color, type) => {
                // sort by confidence
                list.sort((a, b) => b.confidence - a.confidence);
                // Render
                renderSuggestions(container, list, color, { draggable: true, dragType: type });
            };

            renderGroup(ui.functionalChords, groups.functional, '#66cc66', 'functional');
            renderGroup(ui.modalChords, groups.modal, '#bb99ee', 'modal');
            renderGroup(ui.voicingChords, groups.voicing, '#ccaa66', 'voicing');
            renderGroup(ui.intervalChords, groups.interval, '#66aacc', 'interval');
        }

        // ---- ModeLock Dropdown ----
        if (ui.modeLockSelect) {
            ui.modeLockSelect.addEventListener('change', () => {
                modeLockValue = ui.modeLockSelect.value;
                updateModalContext(lastValidChord);
                updateProgressionSuggestions();
                renderCandidatePanel();
                logMessage(`Mode lock: ${modeLockValue}`);
            });
        }

        // ---- Bank Selector ----
        if (ui.progressionBankSelect) {
            ui.progressionBankSelect.addEventListener('change', () => {
                activeBank = ui.progressionBankSelect.value;
                renderCurrentProgression();
                updateProgressionSuggestions();
                logMessage(`Switched to Bank ${activeBank}`);
            });
        }

        // ---- Candidate Panel Click-to-Append ----
        if (ui.candidateChords) {
            ui.candidateChords.addEventListener('click', (e) => {
                const chip = e.target.closest('[data-chord]');
                if (chip && chip.dataset.chord) {
                    progressionBanks[activeBank].push(chip.dataset.chord);
                    bankLockState[activeBank] = true;
                    bankSeedState[activeBank] = false;
                    renderCurrentProgression();
                    updateProgressionSuggestions();
                }
            });
        }

        // Force UI Branding Restore (Ensures no caching of old title)
        document.title = "DAW Musical Companion";
        const headerH1 = document.querySelector('h1');
        if (headerH1) headerH1.innerText = "DAW Musical Companion";

        // Forced Branding Restore (Confirming Live Link)
        document.title = "DAW Musical Companion [LIVE]";
        const h1 = document.querySelector('h1');
        if (h1) {
            h1.innerText = "DAW Musical Companion";
            h1.style.color = "#4db8ff"; // Slight color shift to prove code is live
        }

        initBackgroundSelector();
        logMessage('SYSTEM: DAW Musical Companion Booting...');
        await initializeMidi();
        logMessage('Init complete.');
        document.title = "DAW Musical Companion";

    } catch (err) {
        console.error('CRITICAL INIT FAILURE:', err);
        document.title = "DAW Musical Companion [ERROR]";
        // If logMessage isn't available yet or ui.log is dead, fall back to alert for user
        alert("Application failed to initialize: " + err.message);
    }
});
