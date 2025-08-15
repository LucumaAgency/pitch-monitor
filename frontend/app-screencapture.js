class ScreenCapturePitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        
        this.systemStream = null;
        this.systemAnalyser = null;
        this.systemSource = null;
        
        this.youtubePlayer = null;
        this.isMonitoring = false;
        this.rafId = null;
        
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        document.getElementById('startMic').addEventListener('click', () => this.startMicrophone());
        document.getElementById('stopMic').addEventListener('click', () => this.stopMicrophone());
        document.getElementById('loadYoutube').addEventListener('click', () => this.loadYoutubeVideo());
    }
    
    async startMicrophone() {
        try {
            this.updateStatus('Solicitando acceso al micrófono...', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
            
            this.updateStatus('Micrófono activo. ¡Canta!', 'success');
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
    
    async loadYoutubeVideo() {
        const url = document.getElementById('youtubeUrl').value;
        if (!url) {
            this.updateStatus('Por favor, ingresa una URL de YouTube', 'error');
            return;
        }
        
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            this.updateStatus('URL de YouTube inválida', 'error');
            return;
        }
        
        this.updateStatus('Cargando video...', 'info');
        
        // Cargar iframe de YouTube
        this.loadYoutubeIframe(videoId);
        
        // Mostrar botón para capturar audio del sistema
        this.showSystemAudioButton();
    }
    
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    loadYoutubeIframe(videoId) {
        const container = document.getElementById('youtubePlayer');
        container.innerHTML = '';
        
        if (!this.youtubePlayer) {
            this.youtubePlayer = new YT.Player('youtubePlayer', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    'autoplay': 0,
                    'controls': 0,
                    'modestbranding': 1,
                    'rel': 0
                },
                events: {
                    'onReady': (event) => this.onPlayerReady(event),
                    'onStateChange': (event) => this.onPlayerStateChange(event)
                }
            });
        } else {
            this.youtubePlayer.loadVideoById(videoId);
        }
    }
    
    showSystemAudioButton() {
        // Verificar si ya existe el botón
        if (!document.getElementById('captureSystemAudio')) {
            const controlsDiv = document.getElementById('videoControls');
            const captureBtn = document.createElement('button');
            captureBtn.id = 'captureSystemAudio';
            captureBtn.textContent = '🎧 Capturar Audio del Sistema';
            captureBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            captureBtn.onclick = () => this.captureSystemAudio();
            
            // Insertar al principio de los controles
            controlsDiv.insertBefore(captureBtn, controlsDiv.firstChild);
        }
    }
    
    async captureSystemAudio() {
        try {
            this.updateStatus('Selecciona la pestaña con YouTube para capturar su audio...', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Capturar audio del sistema/pestaña
            // El usuario deberá seleccionar la pestaña de YouTube
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
                } // Necesitamos video mínimo para que funcione en algunos navegadores
            });
            
            // Detener el video track inmediatamente (solo necesitamos audio)
            const videoTracks = this.systemStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
            
            // Verificar que tengamos audio
            const audioTracks = this.systemStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('No se pudo capturar el audio. Asegúrate de compartir el audio de la pestaña.');
            }
            
            // Configurar análisis del audio del sistema
            this.systemSource = this.audioContext.createMediaStreamSource(this.systemStream);
            this.systemAnalyser = this.audioContext.createAnalyser();
            this.systemAnalyser.fftSize = 4096;
            this.systemAnalyser.smoothingTimeConstant = 0.8;
            
            this.systemSource.connect(this.systemAnalyser);
            
            // Cambiar el botón para indicar que está capturando
            const captureBtn = document.getElementById('captureSystemAudio');
            if (captureBtn) {
                captureBtn.textContent = '🔴 Capturando Audio';
                captureBtn.style.background = 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)';
                captureBtn.onclick = () => this.stopSystemAudioCapture();
            }
            
            this.updateStatus('¡Audio del sistema capturado! Reproduce el video de YouTube', 'success');
            
            if (!this.isMonitoring) {
                this.startMonitoring();
            }
            
        } catch (error) {
            console.error('Error al capturar audio del sistema:', error);
            if (error.name === 'NotAllowedError') {
                this.updateStatus('Permiso denegado. Debes compartir el audio de la pestaña.', 'error');
            } else {
                this.updateStatus(`Error: ${error.message}`, 'error');
            }
        }
    }
    
    stopSystemAudioCapture() {
        if (this.systemStream) {
            this.systemStream.getTracks().forEach(track => track.stop());
            this.systemStream = null;
        }
        
        if (this.systemSource) {
            this.systemSource.disconnect();
            this.systemSource = null;
        }
        
        this.systemAnalyser = null;
        
        const captureBtn = document.getElementById('captureSystemAudio');
        if (captureBtn) {
            captureBtn.textContent = '🎧 Capturar Audio del Sistema';
            captureBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            captureBtn.onclick = () => this.captureSystemAudio();
        }
        
        this.updateStatus('Captura de audio del sistema detenida', 'info');
        
        if (!this.micAnalyser) {
            this.stopMonitoring();
        }
    }
    
    onPlayerReady(event) {
        this.updateStatus('Video de YouTube cargado. Haz clic en "Capturar Audio del Sistema"', 'success');
        this.setupVideoControls();
        document.getElementById('videoControls').style.display = 'flex';
    }
    
    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.updateStatus('Reproduciendo video...', 'success');
            document.getElementById('playPause').textContent = '⏸️ Pause';
            
            if (!this.isMonitoring && (this.micAnalyser || this.systemAnalyser)) {
                this.startMonitoring();
            }
        } else if (event.data === YT.PlayerState.PAUSED) {
            document.getElementById('playPause').textContent = '▶️ Play';
        }
        
        this.updateTimeDisplay();
    }
    
    setupVideoControls() {
        const playPauseBtn = document.getElementById('playPause');
        const muteBtn = document.getElementById('muteUnmute');
        const volumeSlider = document.getElementById('volumeSlider');
        
        playPauseBtn.onclick = () => {
            const state = this.youtubePlayer.getPlayerState();
            if (state === YT.PlayerState.PLAYING) {
                this.youtubePlayer.pauseVideo();
            } else {
                this.youtubePlayer.playVideo();
            }
        };
        
        muteBtn.onclick = () => {
            if (this.youtubePlayer.isMuted()) {
                this.youtubePlayer.unMute();
                muteBtn.textContent = '🔊 Unmute';
            } else {
                this.youtubePlayer.mute();
                muteBtn.textContent = '🔇 Mute';
            }
        };
        
        volumeSlider.oninput = (e) => {
            this.youtubePlayer.setVolume(e.target.value);
        };
        
        setInterval(() => {
            if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) {
                this.updateTimeDisplay();
            }
        }, 1000);
    }
    
    updateTimeDisplay() {
        if (!this.youtubePlayer || !this.youtubePlayer.getCurrentTime) return;
        
        const current = this.youtubePlayer.getCurrentTime();
        const duration = this.youtubePlayer.getDuration();
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        document.getElementById('timeDisplay').textContent = 
            `${formatTime(current)} / ${formatTime(duration)}`;
    }
    
    startMonitoring() {
        this.isMonitoring = true;
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
        
        // Análisis del audio del sistema
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
            // Si no hay audio del sistema, mostrar espectro del mic
            this.drawFrequencySpectrum(this.micAnalyser, 'frequencyCanvas');
        }
        
        this.updateMatchLevel();
    }
    
    detectPitch(analyser, source = '') {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        // Calcular RMS para verificar si hay señal
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);
        
        // Solo hacer detección si hay suficiente señal
        if (rms < 0.01) return -1;
        
        return this.YINDetector(buffer, this.audioContext.sampleRate);
    }
    
    YINDetector(buffer, sampleRate) {
        const threshold = 0.15;
        const bufferSize = buffer.length;
        const halfBufferSize = Math.floor(bufferSize / 2);
        const yinBuffer = new Float32Array(halfBufferSize);
        
        let tau;
        
        // Paso 1: Diferencia cuadrática
        for (tau = 1; tau < halfBufferSize; tau++) {
            let sum = 0;
            for (let i = 0; i < halfBufferSize; i++) {
                const delta = buffer[i] - buffer[i + tau];
                sum += delta * delta;
            }
            yinBuffer[tau] = sum;
        }
        
        // Paso 2: Normalización acumulativa
        yinBuffer[0] = 1;
        let runningSum = 0;
        for (tau = 1; tau < halfBufferSize; tau++) {
            runningSum += yinBuffer[tau];
            yinBuffer[tau] *= tau / runningSum;
        }
        
        // Paso 3: Búsqueda del threshold
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
        
        // Paso 4: Interpolación parabólica
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
                this.updateStatus('¡Excelente! Estás afinado', 'success');
            } else if (matchPercentage > 70) {
                this.updateStatus('Casi... ajusta un poco', 'info');
            }
        }
    }
    
    updateStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }
}

let pitchMonitor;

window.addEventListener('DOMContentLoaded', () => {
    pitchMonitor = new ScreenCapturePitchMonitor();
});

function onYouTubeIframeAPIReady() {
    console.log('YouTube API lista - Modo Screen Capture');
}