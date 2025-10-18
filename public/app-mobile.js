/**
 * PITCH MONITOR - VERSIÓN MÓVIL
 * Versión simplificada para dispositivos móviles
 */

class MobilePitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;

        // Audio element para la música
        this.audioElement = null;
        this.audioAnalyser = null;
        this.audioSource = null;

        this.isMonitoring = false;
        this.rafId = null;

        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Timeline data
        this.timelineData = [];
        this.maxTimelinePoints = 200;
        this.timelineStartTime = null;

        // Debug info
        this.debugLines = [];
        this.maxDebugLines = 10;

        this.initializeEventListeners();
    }

    addDebugLine(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.debugLines.push(`[${timestamp}] ${message}`);
        if (this.debugLines.length > this.maxDebugLines) {
            this.debugLines.shift();
        }

        const debugContent = document.getElementById('debugContent');
        if (debugContent) {
            debugContent.innerHTML = this.debugLines.join('<br>');
        }

        console.log(message);
    }
    
    initializeEventListeners() {
        document.getElementById('startMic').addEventListener('click', () => this.startMicrophone());
        document.getElementById('stopMic').addEventListener('click', () => this.stopMicrophone());

        // Input de archivo de audio (solo en móvil)
        const audioFileInput = document.getElementById('audioFile');
        if (audioFileInput) {
            audioFileInput.addEventListener('change', (e) => this.loadAudioFile(e));
        }

        // Botón copiar debug
        const copyBtn = document.getElementById('copyDebugBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const text = this.debugLines.join('\n');
                navigator.clipboard.writeText(text).then(() => {
                    const btn = document.getElementById('copyDebugBtn');
                    const originalText = btn.textContent;
                    btn.textContent = '✅ Copiado!';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                }).catch(err => {
                    this.addDebugLine('Error al copiar: ' + err);
                });
            });
        }
    }
    
    async startMicrophone() {
        try {
            this.addDebugLine('🎤 Iniciando micrófono...');
            this.updateStatus('Solicitando acceso al micrófono...', 'info');

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.addDebugLine(`AudioContext: sampleRate=${this.audioContext.sampleRate}`);
            }

            // Configuración optimizada para móvil
            const constraints = {
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            };

            // En iOS necesitamos configuración especial
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                constraints.audio.sampleRate = 44100;
                this.addDebugLine('📱 iOS detectado');
            }

            this.addDebugLine('🔐 Solicitando permisos...');
            this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.addDebugLine('✅ Permisos concedidos');

            this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 4096;
            this.micAnalyser.smoothingTimeConstant = 0.3;

            this.addDebugLine(`FFT Size: ${this.micAnalyser.fftSize}`);
            this.addDebugLine(`Smoothing: ${this.micAnalyser.smoothingTimeConstant}`);

            this.micSource.connect(this.micAnalyser);

            document.getElementById('startMic').disabled = true;
            document.getElementById('stopMic').disabled = false;

            this.updateStatus('✅ Micrófono activo. ¡Canta!', 'success');
            this.addDebugLine('▶️ Iniciando monitoreo...');
            this.startMonitoring();

        } catch (error) {
            this.addDebugLine(`❌ ERROR: ${error.message}`);
            console.error('Error al acceder al micrófono:', error);
            this.updateStatus('Error: No se pudo acceder al micrófono', 'error');
        }
    }
    
    stopMicrophone() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
        }

        if (this.micSource) {
            this.micSource.disconnect();
            this.micSource = null;
        }

        document.getElementById('startMic').disabled = false;
        document.getElementById('stopMic').disabled = true;

        this.updateStatus('Micrófono detenido', 'info');
        this.stopMonitoring();
    }

    loadAudioFile(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        this.addDebugLine(`🎵 Cargando archivo: ${file.name}`);

        // Crear URL del archivo
        const fileURL = URL.createObjectURL(file);

        // Obtener o crear el elemento de audio
        this.audioElement = document.getElementById('songAudio');
        if (!this.audioElement) {
            this.addDebugLine('❌ Error: Elemento de audio no encontrado');
            return;
        }

        // Asignar el archivo al elemento de audio
        this.audioElement.src = fileURL;
        this.audioElement.load();

        // Crear AudioContext si no existe
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.addDebugLine(`AudioContext: sampleRate=${this.audioContext.sampleRate}`);
        }

        // Crear source y analyser para el audio
        if (!this.audioSource) {
            this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
            this.audioAnalyser = this.audioContext.createAnalyser();
            this.audioAnalyser.fftSize = 4096;
            this.audioAnalyser.smoothingTimeConstant = 0.3;

            // Conectar: source -> analyser -> destination (para que se escuche)
            this.audioSource.connect(this.audioAnalyser);
            this.audioAnalyser.connect(this.audioContext.destination);

            this.addDebugLine('🎵 Analyser de audio creado');
        }

        // Mostrar controles de audio
        this.audioElement.style.display = 'block';

        this.updateStatus(`✅ Archivo cargado: ${file.name}`, 'success');
        this.addDebugLine('▶️ Dale play para empezar!');

        // Event listener para cuando empiece a reproducir
        this.audioElement.addEventListener('play', () => {
            this.addDebugLine('▶️ Reproduciendo audio');
            if (!this.isMonitoring) {
                this.startMonitoring();
            }
        });

        this.audioElement.addEventListener('pause', () => {
            this.addDebugLine('⏸️ Audio pausado');
        });
    }
    
    startMonitoring() {
        this.isMonitoring = true;
        console.log('=== Iniciando monitoreo de pitch ===');
        console.log('AudioContext state:', this.audioContext.state);
        console.log('Analyser configurado:', this.micAnalyser ? 'Sí' : 'No');
        console.log('FFT Size:', this.micAnalyser?.fftSize);
        this.animate();
    }
    
    stopMonitoring() {
        this.isMonitoring = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
    }
    
    animate() {
        if (!this.isMonitoring) return;

        this.rafId = requestAnimationFrame(() => this.animate());

        const currentTime = Date.now();
        let micPitch = null;
        let internalPitch = null;

        // Log cada 60 frames (~1 segundo)
        if (!this.frameCount) this.frameCount = 0;
        this.frameCount++;

        // Detectar pitch del micrófono (tu voz + ambiente)
        if (this.micAnalyser) {
            micPitch = this.detectPitch(this.micAnalyser, 'mic');

            if (this.frameCount % 60 === 0) {
                console.log('🎤 Pitch micrófono:', micPitch > 0 ? micPitch.toFixed(2) + ' Hz' : 'Sin señal');
            }

            if (micPitch && micPitch > 0) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;

                // Mostrar cents
                const centsEl = document.getElementById('userCents');
                if (centsEl) {
                    const centsSign = note.cents >= 0 ? '+' : '';
                    centsEl.textContent = `${centsSign}${note.cents} cents`;
                }

                // Mostrar dirección de pitch
                const pitchDirEl = document.getElementById('pitchDirection');
                if (pitchDirEl) {
                    if (Math.abs(note.cents) <= 10) {
                        pitchDirEl.textContent = '✅ Perfecto';
                        pitchDirEl.className = 'pitch-direction perfect';
                    } else if (note.cents > 10) {
                        pitchDirEl.textContent = '⬇️ Bajar';
                        pitchDirEl.className = 'pitch-direction high';
                    } else {
                        pitchDirEl.textContent = '⬆️ Subir';
                        pitchDirEl.className = 'pitch-direction low';
                    }
                }
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
                const centsEl = document.getElementById('userCents');
                if (centsEl) centsEl.textContent = '±0 cents';
                const pitchDirEl = document.getElementById('pitchDirection');
                if (pitchDirEl) {
                    pitchDirEl.textContent = '';
                    pitchDirEl.className = 'pitch-direction';
                }
            }
        }

        // Detectar pitch del audio de la canción
        if (this.audioAnalyser) {
            internalPitch = this.detectPitch(this.audioAnalyser, 'song');

            if (this.frameCount % 60 === 0) {
                console.log('🎵 Pitch música:', internalPitch > 0 ? internalPitch.toFixed(2) + ' Hz' : 'Sin señal');
            }

            // Mostrar la nota de la canción
            const videoNoteEl = document.getElementById('videoNote');
            const videoFreqEl = document.getElementById('videoFreq');
            if (videoNoteEl && videoFreqEl) {
                if (internalPitch && internalPitch > 0) {
                    const note = this.frequencyToNote(internalPitch);
                    videoNoteEl.textContent = note.note;
                    videoFreqEl.textContent = `${internalPitch.toFixed(1)} Hz`;
                } else {
                    videoNoteEl.textContent = '--';
                    videoFreqEl.textContent = '0 Hz';
                }
            }
        }

        // Agregar punto al timeline
        if (!this.timelineStartTime) {
            this.timelineStartTime = currentTime;
        }

        this.timelineData.push({
            time: currentTime - this.timelineStartTime,
            micFreq: micPitch > 0 ? micPitch : null,
            songFreq: internalPitch > 0 ? internalPitch : null
        });

        // Limitar el tamaño del timeline (últimos 10 segundos)
        if (this.timelineData.length > this.maxTimelinePoints) {
            this.timelineData.shift();
        }

        // Dibujar timeline de notas
        this.drawNoteTimeline();
    }
    
    drawNoteTimeline() {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // Configurar dimensiones
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const width = canvas.width;
        const height = canvas.height;

        // Fondo
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Dibujar grid de notas
        this.drawNoteGrid(ctx, width, height);

        // Si no hay datos, salir
        if (this.timelineData.length < 2) return;

        // Calcular escala de tiempo (últimos 10 segundos visibles)
        const currentTime = Date.now() - this.timelineStartTime;
        const timeWindow = 10000; // 10 segundos en milisegundos
        const timeStart = Math.max(0, currentTime - timeWindow);

        // Dibujar línea del audio de la canción (verde)
        if (this.audioAnalyser) {
            ctx.strokeStyle = '#48bb78';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#48bb78';
            ctx.lineWidth = 3;
            ctx.beginPath();

            let firstSong = true;
            this.timelineData.forEach(point => {
                if (point.songFreq && point.songFreq > 0) {
                    const x = ((point.time - timeStart) / timeWindow) * width;
                    if (x >= 0 && x <= width) {
                        const y = this.frequencyToY(point.songFreq, height);

                        if (firstSong) {
                            ctx.moveTo(x, y);
                            firstSong = false;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                }
            });
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Dibujar línea de tu voz (azul/morado)
        ctx.strokeStyle = '#667eea';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#667eea';
        ctx.lineWidth = 3;
        ctx.beginPath();

        let firstMic = true;
        this.timelineData.forEach(point => {
            if (point.micFreq && point.micFreq > 0) {
                const x = ((point.time - timeStart) / timeWindow) * width;
                if (x >= 0 && x <= width) {
                    const y = this.frequencyToY(point.micFreq, height);

                    if (firstMic) {
                        ctx.moveTo(x, y);
                        firstMic = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
        });
        ctx.stroke();

        ctx.shadowBlur = 0;

        // Línea vertical del tiempo actual (lado derecho)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(width - 1, 0);
        ctx.lineTo(width - 1, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Leyenda
        ctx.font = '12px monospace';
        ctx.fillStyle = '#48bb78';
        ctx.fillText('🎵 Canción', 10, 20);
        ctx.fillStyle = '#667eea';
        ctx.fillText('🎤 Tu Voz', 10, 35);
    }

    drawNoteGrid(ctx, width, height) {
        // Rango de notas: C2 a B6 (5 octavas = 60 semitonos)
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octaves = [2, 3, 4, 5, 6];

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';

        // Dibujar líneas horizontales para cada nota
        octaves.forEach(octave => {
            notes.forEach((note, noteIndex) => {
                const noteName = note + octave;
                const y = this.noteToY(noteName, height);

                // Línea horizontal
                if (note === 'C') {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Línea más visible para C
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                }

                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();

                // Etiqueta de nota (solo para C, E, G)
                if (note === 'C' || note === 'E' || note === 'G') {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                    ctx.fillText(noteName, 5, y - 2);
                }
            });
        });
    }

    frequencyToY(frequency, canvasHeight) {
        // Convertir frecuencia a nota primero
        const noteObj = this.frequencyToNote(frequency);
        if (noteObj.note === '--') return canvasHeight / 2;

        // Usar noteToY para obtener posición basada en nota discreta
        return this.noteToY(noteObj.note, canvasHeight);
    }

    noteToY(noteName, canvasHeight) {
        // Mapeo de notas a semitonos desde C2 (índice 0)
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };

        // Extraer nota y octava (ej: "C5" -> nota="C", octave=5)
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) return canvasHeight / 2;

        const [, note, octaveStr] = match;
        const octave = parseInt(octaveStr);

        // Calcular semitonos desde C2 (octava 2)
        const semitonesFromC2 = (octave - 2) * 12 + noteMap[note];

        // Rango: C2 (0) a B6 (59 semitonos)
        const minSemitone = 0;
        const maxSemitone = 59;

        // Invertir para que notas altas estén arriba
        return ((maxSemitone - semitonesFromC2) / maxSemitone) * canvasHeight;
    }
    
    detectPitch(analyser, source = 'mic') {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);

        // Calcular RMS
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);

        // Log RMS cada 30 frames (más frecuente para debug) - solo para micrófono
        if (source === 'mic' && this.frameCount % 30 === 0) {
            this.addDebugLine(`🎤 RMS: ${rms.toFixed(6)} ${rms < 0.005 ? '❌' : '✅'}`);
        }

        // Log RMS para audio de la canción cada 60 frames
        if (source === 'song' && this.frameCount % 60 === 0) {
            this.addDebugLine(`🎵 RMS: ${rms.toFixed(6)} ${rms < 0.001 ? '❌' : '✅'}`);
        }

        // Umbral diferente según la fuente
        // Micrófono: umbral calibrado 0.005 (filtra ruido ambiente)
        // Audio de canción: umbral más bajo 0.001 (audio limpio de archivo)
        const threshold = source === 'mic' ? 0.005 : 0.001;
        if (rms < threshold) return -1;

        // Usar autocorrelación simple para móvil (más rápido)
        const pitch = this.autocorrelate(buffer, this.audioContext.sampleRate, source);

        if (source === 'mic' && this.frameCount % 30 === 0) {
            if (pitch > 0) {
                const note = this.frequencyToNote(pitch);
                this.addDebugLine(`🎤 Freq: ${pitch.toFixed(1)} Hz → ${note.note}`);
            } else {
                this.addDebugLine('🎤 Freq: No detectada');
            }
        }

        if (source === 'song' && this.frameCount % 60 === 0) {
            if (pitch > 0) {
                const note = this.frequencyToNote(pitch);
                this.addDebugLine(`🎵 Freq: ${pitch.toFixed(1)} Hz → ${note.note}`);
            } else {
                this.addDebugLine('🎵 Freq: No detectada');
            }
        }

        return pitch;
    }
    
    autocorrelate(buffer, sampleRate, source = 'mic') {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(MAX_SAMPLES);

        // Calcular límites de offset basados en frecuencias vocales
        // Frecuencia máxima: 1000 Hz → offset mínimo
        // Frecuencia mínima: 100 Hz (más estricto) → offset máximo
        const MIN_OFFSET = Math.floor(sampleRate / 1000); // ~48 para 48kHz
        const MAX_OFFSET = Math.floor(sampleRate / 100);  // ~480 para 48kHz (antes era 80Hz)

        // Calcular autocorrelación para cada offset
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;

            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs(buffer[i] - buffer[i + offset]);
            }

            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation;
        }

        // Buscar el primer pico significativo DESPUÉS del offset mínimo
        // Umbral reducido para mejor detección en móvil
        for (let offset = MIN_OFFSET; offset < Math.min(MAX_OFFSET, MAX_SAMPLES); offset++) {
            if (correlations[offset] > 0.3 && correlations[offset] > bestCorrelation) {
                // Verificar que sea un pico local
                const isPeak = offset > MIN_OFFSET && offset < MAX_SAMPLES - 1 &&
                             correlations[offset] > correlations[offset - 1] &&
                             correlations[offset] > correlations[offset + 1];

                if (isPeak) {
                    bestCorrelation = correlations[offset];
                    bestOffset = offset;
                    foundGoodCorrelation = true;
                    break; // Usar el primer buen pico
                }
            }
        }

        // Debug cada 60 frames
        if (this.frameCount % 60 === 0) {
            this.addDebugLine(`Autocorr: best=${bestCorrelation.toFixed(3)} offset=${bestOffset} (rango:${MIN_OFFSET}-${MAX_OFFSET})`);
        }

        if (foundGoodCorrelation && bestOffset > 0) {
            // Interpolar para obtener mejor precisión
            let shift = 0;
            if (bestOffset > 0 && bestOffset < MAX_SAMPLES - 1) {
                const prev = correlations[bestOffset - 1];
                const curr = correlations[bestOffset];
                const next = correlations[bestOffset + 1];
                shift = (prev - next) / (2 * (2 * curr - prev - next));
            }

            const frequency = sampleRate / (bestOffset + shift);

            // Validar que la frecuencia esté en rango vocal (100Hz - 1000Hz)
            // C2 = 65.4 Hz, pero usamos 100 Hz para filtrar ruido grave
            if (frequency >= 100 && frequency <= 1000) {
                return frequency;
            } else if (this.frameCount % 60 === 0) {
                this.addDebugLine(`Freq fuera rango: ${frequency.toFixed(1)} Hz`);
            }
        }

        return -1;
    }
    
    frequencyToNote(frequency) {
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);

        if (frequency > 0) {
            const halfStepsBelowMiddleC = 12 * Math.log2(frequency / C0);
            const roundedHalfSteps = Math.round(halfStepsBelowMiddleC);
            const octave = Math.floor(roundedHalfSteps / 12);
            const noteIndex = roundedHalfSteps % 12;

            return {
                note: this.noteStrings[noteIndex] + octave,
                cents: Math.round((halfStepsBelowMiddleC - roundedHalfSteps) * 100)
            };
        }

        return { note: '--', cents: 0 };
    }
    
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.innerHTML = message;
        statusEl.className = `status ${type}`;
    }
}

// Función para inicializar la versión correcta
function initializePitchMonitor() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        window.pitchMonitor = new MobilePitchMonitor();
        console.log('Pitch Monitor Móvil inicializado');
    } else {
        // En desktop cargar el híbrido de forma dinámica
        const script = document.createElement('script');
        script.src = 'app-hybrid-offline.js?v=13';
        script.onload = () => {
            // Verificar si la clase está disponible
            if (typeof HybridOfflinePitchMonitor !== 'undefined') {
                window.pitchMonitor = new HybridOfflinePitchMonitor();
                console.log('Pitch Monitor Desktop (Híbrido) inicializado');
            } else {
                console.error('HybridOfflinePitchMonitor no está definido');
                window.pitchMonitor = new MobilePitchMonitor();
                console.log('Fallback: Pitch Monitor Móvil inicializado');
            }
        };
        script.onerror = () => {
            // Si falla, usar versión móvil como fallback
            console.error('Error cargando app-hybrid-offline.js');
            window.pitchMonitor = new MobilePitchMonitor();
            console.log('Fallback: Pitch Monitor Móvil inicializado');
        };
        document.body.appendChild(script);
    }
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initializePitchMonitor);
} else {
    // DOM ya está listo
    initializePitchMonitor();
}