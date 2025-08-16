/**
 * PITCH MONITOR - VERSIÓN HÍBRIDA OFFLINE
 * Detecta tu voz del micrófono Y el audio de otra pestaña
 */

class HybridOfflinePitchMonitor {
    constructor() {
        this.audioContext = null;
        
        // Micrófono
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        
        // Sistema/Pestaña
        this.systemStream = null;
        this.systemAnalyser = null;
        this.systemSource = null;
        
        this.isMonitoring = false;
        this.rafId = null;
        
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Frecuencias de notas para visualización (C3 a B5)
        this.noteFrequencies = this.generateNoteFrequencies();
        
        // Timeline data
        this.timelineData = [];
        this.maxTimelinePoints = 200; // Puntos máximos en el timeline
        this.timelineStartTime = null;
        
        this.initializeEventListeners();
        this.updateUI();
        this.createTimelineVisualization();
    }
    
    generateNoteFrequencies() {
        const frequencies = [];
        const A4 = 440;
        
        // Generar notas desde C2 hasta B6 (5 octavas)
        for (let octave = 2; octave <= 6; octave++) {
            for (let note = 0; note < 12; note++) {
                const halfSteps = (octave - 4) * 12 + note - 9; // A4 está 9 semitonos sobre C4
                const freq = A4 * Math.pow(2, halfSteps / 12);
                frequencies.push({
                    note: this.noteStrings[note] + octave,
                    frequency: freq,
                    isSharp: this.noteStrings[note].includes('#')
                });
            }
        }
        
        return frequencies;
    }
    
    createTimelineVisualization() {
        // Reemplazar el canvas de waveform con visualización de timeline
        const waveformCanvas = document.getElementById('waveformCanvas');
        if (waveformCanvas && waveformCanvas.parentNode) {
            // Crear contenedor para el timeline
            const timelineContainer = document.createElement('div');
            timelineContainer.id = 'timelineVisualization';
            timelineContainer.style.cssText = `
                width: 100%;
                height: 600px;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 8px;
                position: relative;
                overflow: hidden;
            `;
            
            // Canvas para el timeline
            const canvas = document.createElement('canvas');
            canvas.id = 'timelineCanvas';
            canvas.style.cssText = `
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            `;
            
            // Línea central (tiempo actual)
            const centerLine = document.createElement('div');
            centerLine.style.cssText = `
                position: absolute;
                left: 50%;
                top: 0;
                bottom: 0;
                width: 2px;
                background: rgba(255, 255, 255, 0.8);
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
                z-index: 10;
            `;
            
            // Indicador de tiempo actual
            const timeIndicator = document.createElement('div');
            timeIndicator.style.cssText = `
                position: absolute;
                left: 50%;
                top: 10px;
                transform: translateX(-50%);
                padding: 5px 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                border-radius: 5px;
                font-family: monospace;
                font-size: 12px;
                z-index: 11;
            `;
            timeIndicator.textContent = 'AHORA';
            
            timelineContainer.appendChild(canvas);
            timelineContainer.appendChild(centerLine);
            timelineContainer.appendChild(timeIndicator);
            
            waveformCanvas.parentNode.replaceChild(timelineContainer, waveformCanvas);
            
            // Dibujar las líneas de notas horizontales
            this.setupTimelineCanvas();
        }
    }
    
    setupTimelineCanvas() {
        const canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;
        
        // Configurar dimensiones del canvas
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Dibujar líneas de referencia de notas
        this.drawTimelineGrid();
    }
    
    drawTimelineGrid() {
        const canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar líneas horizontales para cada nota
        const naturalNotes = this.noteFrequencies.filter(n => !n.isSharp);
        const noteHeight = canvas.height / naturalNotes.length;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        naturalNotes.forEach((note, index) => {
            const y = index * noteHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
            
            // Etiquetas de notas en el lado izquierdo
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.font = '10px monospace';
            ctx.fillText(note.note, 5, y + 15);
        });
        
        // Líneas verticales de tiempo (cada segundo)
        const secondWidth = canvas.width / 10; // 10 segundos de vista
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        
        for (let i = 0; i < 11; i++) {
            const x = i * secondWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }
    
    createIndicators() {
        const container = document.getElementById('timelineVisualization');
        if (!container) return;
        
        // Indicador de diferencia de pitch
        const diffIndicator = document.createElement('div');
        diffIndicator.id = 'pitchDifference';
        diffIndicator.style.cssText = `
            position: absolute;
            right: 10px;
            top: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            color: white;
            font-family: monospace;
            font-size: 14px;
            z-index: 20;
        `;
        container.appendChild(diffIndicator);
        
        // Indicador de nivel de audio
        const audioLevel = document.createElement('div');
        audioLevel.id = 'audioLevelIndicator';
        audioLevel.style.cssText = `
            position: absolute;
            left: 10px;
            bottom: 10px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 8px;
            color: white;
            font-family: monospace;
            font-size: 11px;
            z-index: 20;
        `;
        audioLevel.innerHTML = `
            <div>🎤 Mic: <span id="micLevel">--</span></div>
            <div>🎵 YouTube: <span id="systemLevel">--</span></div>
        `;
        container.appendChild(audioLevel);
    }
    
    updateUI() {
        // Modificar el botón de YouTube para captura de sistema
        const loadBtn = document.getElementById('loadYoutube');
        if (loadBtn) {
            loadBtn.textContent = '🎧 Capturar Audio de Pestaña';
            loadBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            loadBtn.disabled = false;
        }
        
        // Añadir instrucciones
        const status = document.getElementById('status');
        if (status) {
            status.innerHTML = `
                <strong>📋 Instrucciones:</strong><br>
                1. Activa el micrófono<br>
                2. Abre YouTube en otra pestaña<br>
                3. Click en "Capturar Audio de Pestaña"<br>
                4. Selecciona la pestaña de YouTube y marca "Compartir audio"
            `;
        }
    }
    
    initializeEventListeners() {
        document.getElementById('startMic').addEventListener('click', () => this.startMicrophone());
        document.getElementById('stopMic').addEventListener('click', () => this.stopMicrophone());
        
        const loadBtn = document.getElementById('loadYoutube');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.captureSystemAudio());
        }
    }
    
    async startMicrophone() {
        try {
            this.updateStatus('Solicitando acceso al micrófono...', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext creado, sampleRate:', this.audioContext.sampleRate);
            }
            
            this.micStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            
            this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 4096;
            this.micAnalyser.smoothingTimeConstant = 0.8;
            
            this.micSource.connect(this.micAnalyser);
            
            document.getElementById('startMic').disabled = true;
            document.getElementById('stopMic').disabled = false;
            
            this.updateStatus('✅ Micrófono activo. Ahora captura el audio de YouTube', 'success');
            this.startMonitoring();
            
        } catch (error) {
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
        
        if (!this.systemAnalyser) {
            this.stopMonitoring();
        }
    }
    
    async captureSystemAudio() {
        try {
            this.updateStatus('📌 Selecciona la pestaña de YouTube y marca "Compartir audio de la pestaña"', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Capturar audio del sistema/pestaña
            this.systemStream = await navigator.mediaDevices.getDisplayMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100
                },
                video: {
                    width: 1,
                    height: 1
                } // Video mínimo requerido en algunos navegadores
            });
            
            // Detener el video inmediatamente (solo necesitamos audio)
            const videoTracks = this.systemStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
            
            // Verificar que tengamos audio
            const audioTracks = this.systemStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No se capturó audio. Asegúrate de marcar "Compartir audio de la pestaña"');
            }
            
            // Configurar análisis del audio del sistema
            this.systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
            this.systemAnalyser = this.audioContext.createAnalyser();
            this.systemAnalyser.fftSize = 4096;
            this.systemAnalyser.smoothingTimeConstant = 0.8;
            
            this.systemSource.connect(this.systemAnalyser);
            
            // Cambiar el botón
            const loadBtn = document.getElementById('loadYoutube');
            if (loadBtn) {
                loadBtn.textContent = '🔴 Capturando Audio';
                loadBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
                loadBtn.onclick = () => this.stopSystemCapture();
            }
            
            // Actualizar UI
            document.getElementById('videoNote').textContent = 'Detectando...';
            document.getElementById('videoFreq').textContent = 'Audio capturado';
            
            this.updateStatus('✅ ¡Audio capturado! Reproduce el video en YouTube', 'success');
            
            if (!this.isMonitoring) {
                this.startMonitoring();
            }
            
        } catch (error) {
            console.error('Error al capturar audio:', error);
            if (error.name === 'NotAllowedError') {
                this.updateStatus('❌ Cancelaste la captura o no compartiste el audio', 'error');
            } else {
                this.updateStatus(`❌ ${error.message}`, 'error');
            }
        }
    }
    
    stopSystemCapture() {
        if (this.systemStream) {
            this.systemStream.getTracks().forEach(track => track.stop());
            this.systemStream = null;
        }
        
        if (this.systemSource) {
            this.systemSource.disconnect();
            this.systemSource = null;
        }
        
        this.systemAnalyser = null;
        
        const loadBtn = document.getElementById('loadYoutube');
        if (loadBtn) {
            loadBtn.textContent = '🎧 Capturar Audio de Pestaña';
            loadBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            loadBtn.onclick = () => this.captureSystemAudio();
        }
        
        document.getElementById('videoNote').textContent = '--';
        document.getElementById('videoFreq').textContent = '0 Hz';
        
        this.updateStatus('Captura de audio detenida', 'info');
        
        if (!this.micAnalyser) {
            this.stopMonitoring();
        }
    }
    
    startMonitoring() {
        this.isMonitoring = true;
        this.timelineStartTime = Date.now();
        this.timelineData = [];
        console.log('Iniciando monitoreo de pitch...');
        this.createIndicators(); // Crear indicadores después del timeline
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
        
        let micPitch = null;
        let systemPitch = null;
        const currentTime = Date.now();
        
        // Análisis del micrófono
        if (this.micAnalyser) {
            micPitch = this.detectPitch(this.micAnalyser, 'mic');
            if (micPitch && micPitch > 0) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
            }
        }
        
        // Análisis del sistema/YouTube
        if (this.systemAnalyser) {
            systemPitch = this.detectPitch(this.systemAnalyser, 'system');
            if (systemPitch && systemPitch > 0) {
                const note = this.frequencyToNote(systemPitch);
                document.getElementById('videoNote').textContent = note.note;
                document.getElementById('videoFreq').textContent = `${systemPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('videoNote').textContent = '--';
                document.getElementById('videoFreq').textContent = '0 Hz';
            }
            
            // Dibujar espectro del sistema
            this.drawFrequencySpectrum(this.systemAnalyser, 'frequencyCanvas');
        } else if (this.micAnalyser) {
            // Si no hay sistema, mostrar espectro del mic
            this.drawFrequencySpectrum(this.micAnalyser, 'frequencyCanvas');
        }
        
        // Agregar punto al timeline
        if (micPitch > 0 || systemPitch > 0) {
            this.timelineData.push({
                time: currentTime - this.timelineStartTime,
                micFreq: micPitch,
                systemFreq: systemPitch
            });
            
            // Limitar el tamaño del timeline
            if (this.timelineData.length > this.maxTimelinePoints) {
                this.timelineData.shift();
            }
        }
        
        // Dibujar timeline
        this.drawTimeline();
        
        // Actualizar indicador de diferencia
        this.updatePitchDifference(micPitch, systemPitch);
        this.updateMatchLevel();
    }
    
    drawTimeline() {
        const canvas = document.getElementById('timelineCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Limpiar y redibujar grid
        this.drawTimelineGrid();
        
        // Configurar para dibujar las líneas de pitch
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        
        // Escala de tiempo: 10 segundos de vista
        const timeScale = width / 10000; // pixels por milisegundo
        
        // Dibujar líneas de pitch
        if (this.timelineData.length > 1) {
            // Línea azul para micrófono
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#4a9eff';
            ctx.beginPath();
            
            let firstMic = true;
            this.timelineData.forEach(point => {
                if (point.micFreq && point.micFreq > 0) {
                    const x = centerX + (point.time - (Date.now() - this.timelineStartTime)) * timeScale;
                    const y = this.frequencyToY(point.micFreq, height);
                    
                    if (firstMic) {
                        ctx.moveTo(x, y);
                        firstMic = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
            
            // Línea roja para YouTube/sistema
            ctx.strokeStyle = '#ff4a4a';
            ctx.shadowColor = '#ff4a4a';
            ctx.beginPath();
            
            let firstSystem = true;
            this.timelineData.forEach(point => {
                if (point.systemFreq && point.systemFreq > 0) {
                    const x = centerX + (point.time - (Date.now() - this.timelineStartTime)) * timeScale;
                    const y = this.frequencyToY(point.systemFreq, height);
                    
                    if (firstSystem) {
                        ctx.moveTo(x, y);
                        firstSystem = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
            
            ctx.shadowBlur = 0;
        }
    }
    
    frequencyToY(frequency, canvasHeight) {
        const minFreq = 65.41; // C2
        const maxFreq = 1975.53; // B6
        const logMin = Math.log2(minFreq);
        const logMax = Math.log2(maxFreq);
        const logFreq = Math.log2(frequency);
        
        return ((logMax - logFreq) / (logMax - logMin)) * canvasHeight;
    }
    
    
    updatePitchDifference(micPitch, systemPitch) {
        const indicator = document.getElementById('pitchDifference');
        if (!indicator) return;
        
        if (micPitch && micPitch > 0 && systemPitch && systemPitch > 0) {
            const cents = 1200 * Math.log2(micPitch / systemPitch);
            let message = '';
            let color = '';
            
            if (Math.abs(cents) < 10) {
                message = '✅ ¡Perfecto!';
                color = '#4ade80';
            } else if (cents > 0) {
                const semitones = Math.abs(cents / 100).toFixed(1);
                message = `⬇️ Baja ${semitones} semitonos`;
                color = '#fbbf24';
            } else {
                const semitones = Math.abs(cents / 100).toFixed(1);
                message = `⬆️ Sube ${semitones} semitonos`;
                color = '#60a5fa';
            }
            
            indicator.innerHTML = `
                <div style="color: ${color}; font-weight: bold;">${message}</div>
                <div style="color: #888; font-size: 12px; margin-top: 5px;">
                    Diferencia: ${cents.toFixed(0)} cents
                </div>
            `;
        } else if (micPitch && micPitch > 0) {
            indicator.innerHTML = `
                <div style="color: #4a9eff;">🎤 Tu nota</div>
                <div style="color: #888; font-size: 12px; margin-top: 5px;">
                    Esperando YouTube...
                </div>
            `;
        } else if (systemPitch && systemPitch > 0) {
            indicator.innerHTML = `
                <div style="color: #ff4a4a;">🎵 YouTube</div>
                <div style="color: #888; font-size: 12px; margin-top: 5px;">
                    Canta para comparar
                </div>
            `;
        } else {
            indicator.innerHTML = `
                <div style="color: #666;">🎹 Esperando audio...</div>
            `;
        }
    }
    
    detectPitch(analyser, source = '') {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        // Calcular RMS (Root Mean Square) para medir el volumen
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        
        // Threshold mucho más bajo para YouTube/sistema
        // YouTube a menudo tiene audio más bajo que el micrófono
        const threshold = source === 'system' ? 0.001 : 0.008;
        
        // Actualizar indicador de nivel de audio
        if (source === 'system') {
            const levelSpan = document.getElementById('systemLevel');
            if (levelSpan) {
                const percentage = Math.min(100, (rms / 0.1) * 100);
                levelSpan.textContent = `${percentage.toFixed(0)}%`;
                levelSpan.style.color = rms > threshold ? '#4ade80' : '#ef4444';
            }
        } else if (source === 'mic') {
            const levelSpan = document.getElementById('micLevel');
            if (levelSpan) {
                const percentage = Math.min(100, (rms / 0.1) * 100);
                levelSpan.textContent = `${percentage.toFixed(0)}%`;
                levelSpan.style.color = rms > threshold ? '#4ade80' : '#ef4444';
            }
        }
        
        if (rms < threshold) return -1;
        
        // Para audio del sistema, intentar autocorrelación si YIN falla
        const pitch = this.YINDetector(buffer, this.audioContext.sampleRate);
        
        // Si YIN no detecta nada pero hay audio, intentar autocorrelación
        if (pitch === -1 && source === 'system' && rms > threshold) {
            return this.autocorrelate(buffer, this.audioContext.sampleRate);
        }
        
        return pitch;
    }
    
    YINDetector(buffer, sampleRate) {
        const threshold = 0.15;
        const bufferSize = buffer.length;
        const halfBufferSize = Math.floor(bufferSize / 2);
        const yinBuffer = new Float32Array(halfBufferSize);
        
        let tau;
        
        for (tau = 1; tau < halfBufferSize; tau++) {
            let sum = 0;
            for (let i = 0; i < halfBufferSize; i++) {
                const delta = buffer[i] - buffer[i + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }
        
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (tau = 1; tau < halfBufferSize; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }
        
        for (tau = 2; tau < halfBufferSize; tau++) {
            if (yinBuffer[tau] < threshold) {
                while (tau + 1 < halfBufferSize && yinBuffer[tau + 1] < yinBuffer[tau]) {
                    tau++;
                }
                break;
            }
        }
        
        if (tau === halfBufferSize || yinBuffer[tau] >= threshold) {
            return -1;
        }
        
        const betterTau = this.parabolicInterpolation(yinBuffer, tau);
        return sampleRate / betterTau;
    }
    
    parabolicInterpolation(array, x) {
        if (x === 0 || x === array.length - 1) return x;
        
        const xs = (array[x - 1] - array[x + 1]) / 
                   (2 * (2 * array[x] - array[x - 1] - array[x + 1]));
        
        return x + xs;
    }
    
    // Método de autocorrelación como respaldo para audio de sistema
    autocorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(MAX_SAMPLES);
        
        // Buscar el mejor offset
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            
            correlation = 1 - (correlation / MAX_SAMPLES);
            correlations[offset] = correlation;
            
            if (correlation > 0.9 && correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
                foundGoodCorrelation = true;
            }
        }
        
        if (foundGoodCorrelation && bestOffset > 0) {
            // Refinar con interpolación parabólica
            const betterOffset = this.parabolicInterpolation(correlations, bestOffset);
            return sampleRate / betterOffset;
        }
        
        return -1;
    }
    
    frequencyToNote(frequency) {
        const A4 = 440;
        const C0 = A4 * Math.pow(2, -4.75);
        
        if (frequency > 0) {
            const halfStepsBelowMiddleC = 12 * Math.log2(frequency / C0);
            const octave = Math.floor(halfStepsBelowMiddleC / 12);
            const noteIndex = Math.round(halfStepsBelowMiddleC) % 12;
            
            return {
                note: this.noteStrings[noteIndex] + octave,
                cents: Math.round((halfStepsBelowMiddleC - Math.round(halfStepsBelowMiddleC)) * 100)
            };
        }
        
        return { note: '--', cents: 0 };
    }
    
    
    drawFrequencySpectrum(analyser, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        analyser.getByteFrequencyData(dataArray);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 10;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength / 10; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
            
            const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
            
            x += barWidth;
        }
    }
    
    updateMatchLevel() {
        const userNote = document.getElementById('userNote').textContent;
        const videoNote = document.getElementById('videoNote').textContent;
        
        if (userNote !== '--' && videoNote !== '--') {
            const userFreq = parseFloat(document.getElementById('userFreq').textContent);
            const videoFreq = parseFloat(document.getElementById('videoFreq').textContent);
            
            const difference = Math.abs(userFreq - videoFreq);
            const maxDifference = 50;
            const matchPercentage = Math.max(0, 100 - (difference / maxDifference * 100));
            
            document.getElementById('matchLevel').style.width = matchPercentage + '%';
            
            if (matchPercentage > 90) {
                this.updateStatus('🎯 ¡Excelente! Estás afinado', 'success');
            } else if (matchPercentage > 70) {
                this.updateStatus('📊 Casi... ajusta un poco', 'info');
            }
        }
    }
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.innerHTML = message;
        statusEl.className = `status ${type}`;
    }
}

// NO inicializar automáticamente - será inicializado por app-mobile.js
console.log('HybridOfflinePitchMonitor clase cargada');