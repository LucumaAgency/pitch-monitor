/**
 * PITCH MONITOR - VERSIÓN MÓVIL
 * Solución para dispositivos móviles con modo karaoke y notas de referencia
 */

class MobilePitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        this.isMonitoring = false;
        this.rafId = null;
        
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Notas de referencia comunes
        this.referenceNotes = {
            'C4': 261.63,
            'D4': 293.66,
            'E4': 329.63,
            'F4': 349.23,
            'G4': 392.00,
            'A4': 440.00,
            'B4': 493.88,
            'C5': 523.25
        };
        
        this.currentReferenceNote = null;
        this.isMobile = this.detectMobile();
        
        this.initializeUI();
        this.initializeEventListeners();
    }
    
    detectMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        console.log('Dispositivo móvil detectado:', isMobile);
        return isMobile;
    }
    
    initializeUI() {
        // Modificar UI para móvil
        const loadBtn = document.getElementById('loadYoutube');
        const urlInput = document.getElementById('youtubeUrl');
        
        if (this.isMobile) {
            // Ocultar input de YouTube
            if (urlInput) {
                urlInput.style.display = 'none';
            }
            
            // Cambiar botón para modo karaoke
            if (loadBtn) {
                loadBtn.textContent = '🎵 Modo Karaoke';
                loadBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }
            
            // Crear selector de notas de referencia
            this.createReferenceSelector();
            
            // Actualizar instrucciones
            const status = document.getElementById('status');
            if (status) {
                status.innerHTML = `
                    <strong>📱 Modo Móvil</strong><br>
                    1. Activa el micrófono<br>
                    2. Selecciona una nota de referencia o modo karaoke<br>
                    3. Reproduce música en otra app (YouTube, Spotify)<br>
                    4. ¡Canta y ve tu afinación!
                `;
            }
        }
    }
    
    createReferenceSelector() {
        const controlGroup = document.querySelector('.control-group:last-child');
        if (!controlGroup) return;
        
        // Crear contenedor de notas de referencia
        const refContainer = document.createElement('div');
        refContainer.innerHTML = `
            <h3 style="color: #667eea; margin: 15px 0 10px 0;">🎹 Nota de Referencia</h3>
            <div id="referenceNotes" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                ${Object.keys(this.referenceNotes).map(note => 
                    `<button class="ref-note-btn" data-note="${note}" style="
                        padding: 10px;
                        background: #f0f0f0;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: all 0.2s;
                    ">${note}</button>`
                ).join('')}
            </div>
            <button id="clearReference" style="
                width: 100%;
                margin-top: 10px;
                padding: 10px;
                background: #ff6b6b;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
            ">Limpiar Referencia</button>
        `;
        
        controlGroup.appendChild(refContainer);
        
        // Añadir event listeners a los botones
        document.querySelectorAll('.ref-note-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setReferenceNote(e.target.dataset.note));
        });
        
        document.getElementById('clearReference')?.addEventListener('click', () => {
            this.clearReferenceNote();
        });
    }
    
    setReferenceNote(note) {
        this.currentReferenceNote = note;
        
        // Actualizar UI
        document.querySelectorAll('.ref-note-btn').forEach(btn => {
            if (btn.dataset.note === note) {
                btn.style.background = '#667eea';
                btn.style.color = 'white';
                btn.style.borderColor = '#667eea';
            } else {
                btn.style.background = '#f0f0f0';
                btn.style.color = 'black';
                btn.style.borderColor = '#ddd';
            }
        });
        
        // Mostrar en "Nota del Video"
        document.getElementById('videoNote').textContent = note;
        document.getElementById('videoFreq').textContent = `${this.referenceNotes[note].toFixed(1)} Hz (Referencia)`;
        
        this.updateStatus(`Nota de referencia: ${note}`, 'info');
    }
    
    clearReferenceNote() {
        this.currentReferenceNote = null;
        
        document.querySelectorAll('.ref-note-btn').forEach(btn => {
            btn.style.background = '#f0f0f0';
            btn.style.color = 'black';
            btn.style.borderColor = '#ddd';
        });
        
        document.getElementById('videoNote').textContent = '--';
        document.getElementById('videoFreq').textContent = 'Sin referencia';
        
        this.updateStatus('Referencia limpiada', 'info');
    }
    
    initializeEventListeners() {
        document.getElementById('startMic').addEventListener('click', () => this.startMicrophone());
        document.getElementById('stopMic').addEventListener('click', () => this.stopMicrophone());
        
        const loadBtn = document.getElementById('loadYoutube');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.toggleKaraokeMode());
        }
    }
    
    toggleKaraokeMode() {
        const loadBtn = document.getElementById('loadYoutube');
        
        if (loadBtn.textContent === '🎵 Modo Karaoke') {
            // Activar modo karaoke
            loadBtn.textContent = '⏹️ Detener Karaoke';
            loadBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
            
            // Simular notas cambiantes (para práctica)
            this.startKaraokeMode();
            
            this.updateStatus('🎤 Modo Karaoke activo - ¡Sigue las notas!', 'success');
        } else {
            // Detener modo karaoke
            loadBtn.textContent = '🎵 Modo Karaoke';
            loadBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            
            this.stopKaraokeMode();
            this.clearReferenceNote();
            
            this.updateStatus('Modo Karaoke detenido', 'info');
        }
    }
    
    startKaraokeMode() {
        // Secuencia de notas para practicar (Do-Re-Mi-Fa-Sol)
        const sequence = ['C4', 'D4', 'E4', 'F4', 'G4', 'F4', 'E4', 'D4', 'C4'];
        let index = 0;
        
        this.karaokeInterval = setInterval(() => {
            this.setReferenceNote(sequence[index]);
            index = (index + 1) % sequence.length;
        }, 2000); // Cambiar nota cada 2 segundos
    }
    
    stopKaraokeMode() {
        if (this.karaokeInterval) {
            clearInterval(this.karaokeInterval);
            this.karaokeInterval = null;
        }
    }
    
    async startMicrophone() {
        try {
            this.updateStatus('Solicitando acceso al micrófono...', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext creado, sampleRate:', this.audioContext.sampleRate);
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
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                constraints.audio.sampleRate = 44100;
            }
            
            this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
            this.micAnalyser = this.audioContext.createAnalyser();
            this.micAnalyser.fftSize = 2048; // Menor para mejor rendimiento en móvil
            this.micAnalyser.smoothingTimeConstant = 0.8;
            
            this.micSource.connect(this.micAnalyser);
            
            document.getElementById('startMic').disabled = true;
            document.getElementById('stopMic').disabled = false;
            
            this.updateStatus('✅ Micrófono activo. ¡Canta!', 'success');
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
        this.stopMonitoring();
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
        
        if (this.micAnalyser) {
            const micPitch = this.detectPitch(this.micAnalyser);
            if (micPitch && micPitch > 0) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;
                
                // Si hay nota de referencia, comparar
                if (this.currentReferenceNote) {
                    this.compareWithReference(micPitch);
                }
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
            }
            
            this.drawWaveform(this.micAnalyser);
            this.drawFrequencySpectrum(this.micAnalyser);
        }
    }
    
    compareWithReference(userFreq) {
        if (!this.currentReferenceNote) return;
        
        const refFreq = this.referenceNotes[this.currentReferenceNote];
        const difference = Math.abs(userFreq - refFreq);
        const cents = 1200 * Math.log2(userFreq / refFreq);
        
        // Actualizar barra de coincidencia
        const maxDifference = 50;
        const matchPercentage = Math.max(0, 100 - (difference / maxDifference * 100));
        
        document.getElementById('matchLevel').style.width = matchPercentage + '%';
        
        // Feedback visual
        if (Math.abs(cents) < 10) {
            this.updateStatus('🎯 ¡Perfecto! Estás afinado', 'success');
        } else if (Math.abs(cents) < 30) {
            if (cents > 0) {
                this.updateStatus('📈 Un poco alto, baja un poco', 'info');
            } else {
                this.updateStatus('📉 Un poco bajo, sube un poco', 'info');
            }
        } else {
            this.updateStatus('🎵 Sigue intentando', 'info');
        }
    }
    
    detectPitch(analyser) {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        // Calcular RMS
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        
        if (rms < 0.01) return -1;
        
        // Usar autocorrelación simple para móvil (más rápido)
        return this.autocorrelate(buffer, this.audioContext.sampleRate);
    }
    
    autocorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            
            correlation = 1 - (correlation / MAX_SAMPLES);
            
            if (correlation > 0.9 && correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestOffset = offset;
                foundGoodCorrelation = true;
            }
        }
        
        if (foundGoodCorrelation && bestOffset > 0) {
            return sampleRate / bestOffset;
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
    
    drawWaveform(analyser) {
        const canvas = document.getElementById('waveformCanvas');
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
    
    drawFrequencySpectrum(analyser) {
        const canvas = document.getElementById('frequencyCanvas');
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
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.innerHTML = message;
        statusEl.className = `status ${type}`;
    }
}

// Inicializar versión correcta según dispositivo
let pitchMonitor;

window.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        pitchMonitor = new MobilePitchMonitor();
        console.log('Pitch Monitor Móvil inicializado');
    } else {
        // En desktop cargar el híbrido
        const script = document.createElement('script');
        script.src = 'app-hybrid-offline.js?v=4';
        document.body.appendChild(script);
    }
});