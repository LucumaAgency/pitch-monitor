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
        
        this.initializeEventListeners();
        this.updateUI();
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
        console.log('Iniciando monitoreo de pitch...');
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
        
        // Análisis del micrófono
        if (this.micAnalyser) {
            const micPitch = this.detectPitch(this.micAnalyser, 'mic');
            if (micPitch && micPitch > 0) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
            }
            
            this.drawWaveform(this.micAnalyser, 'waveformCanvas');
        }
        
        // Análisis del sistema/YouTube
        if (this.systemAnalyser) {
            const systemPitch = this.detectPitch(this.systemAnalyser, 'system');
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
        
        this.updateMatchLevel();
    }
    
    detectPitch(analyser, source = '') {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        // Calcular RMS
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        
        // Threshold más bajo para YouTube
        const threshold = source === 'system' ? 0.005 : 0.01;
        if (rms < threshold) return -1;
        
        return this.YINDetector(buffer, this.audioContext.sampleRate);
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
    
    drawWaveform(analyser, canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#667eea';
        ctx.beginPath();
        
        const sliceWidth = canvas.width / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
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

// Inicializar solo si no está ya inicializado
if (!window.pitchMonitor) {
    window.addEventListener('DOMContentLoaded', () => {
        window.pitchMonitor = new HybridOfflinePitchMonitor();
        console.log('Pitch Monitor Híbrido inicializado - Captura de pestaña disponible');
    });
}