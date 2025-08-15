class HybridPitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        this.youtubePlayer = null;
        this.isMonitoring = false;
        this.rafId = null;
        this.serverUrl = window.location.origin;
        
        this.videoAudioElement = null;
        this.videoAnalyser = null;
        this.videoSource = null;
        
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
        
        if (!this.videoAnalyser) {
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
        
        this.updateStatus('Cargando video y audio...', 'info');
        
        // Cargar iframe de YouTube para visualización
        this.loadYoutubeIframe(videoId);
        
        // Cargar audio separado para análisis
        await this.loadAudioForAnalysis(videoId);
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
    
    async loadAudioForAnalysis(videoId) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Remover audio element anterior si existe
            if (this.videoAudioElement) {
                this.videoAudioElement.pause();
                this.videoAudioElement.remove();
                if (this.videoSource) {
                    this.videoSource.disconnect();
                }
            }
            
            // Crear elemento de audio oculto para análisis
            this.videoAudioElement = document.createElement('audio');
            this.videoAudioElement.crossOrigin = 'anonymous';
            this.videoAudioElement.src = `${this.serverUrl}/api/youtube-stream/${videoId}`;
            this.videoAudioElement.volume = 0; // Silenciar para evitar doble audio
            document.body.appendChild(this.videoAudioElement);
            
            // Configurar análisis de audio
            this.videoSource = this.audioContext.createMediaElementSource(this.videoAudioElement);
            this.videoAnalyser = this.audioContext.createAnalyser();
            this.videoAnalyser.fftSize = 4096;
            this.videoAnalyser.smoothingTimeConstant = 0.8;
            
            this.videoSource.connect(this.videoAnalyser);
            this.videoSource.connect(this.audioContext.destination);
            
            this.updateStatus('Audio del video listo para análisis', 'success');
            
        } catch (error) {
            console.error('Error al cargar audio:', error);
            this.updateStatus('Nota: El análisis de audio requiere el servidor Node.js activo', 'info');
        }
    }
    
    onPlayerReady(event) {
        this.updateStatus('Video de YouTube cargado', 'success');
        this.setupVideoControls();
        document.getElementById('videoControls').style.display = 'flex';
    }
    
    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.updateStatus('Reproduciendo video...', 'success');
            document.getElementById('playPause').textContent = '⏸️ Pause';
            
            // Sincronizar audio de análisis con video
            if (this.videoAudioElement) {
                this.videoAudioElement.currentTime = this.youtubePlayer.getCurrentTime();
                this.videoAudioElement.play();
            }
            
            if (!this.isMonitoring) {
                this.startMonitoring();
            }
        } else if (event.data === YT.PlayerState.PAUSED) {
            document.getElementById('playPause').textContent = '▶️ Play';
            if (this.videoAudioElement) {
                this.videoAudioElement.pause();
            }
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
        
        // Actualizar tiempo cada segundo
        setInterval(() => {
            if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) {
                this.updateTimeDisplay();
                
                // Mantener sincronización con audio de análisis
                if (this.videoAudioElement && this.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                    const timeDiff = Math.abs(this.videoAudioElement.currentTime - this.youtubePlayer.getCurrentTime());
                    if (timeDiff > 0.5) {
                        this.videoAudioElement.currentTime = this.youtubePlayer.getCurrentTime();
                    }
                }
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
            const micPitch = this.detectPitch(this.micAnalyser);
            if (micPitch && micPitch > 0) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
            }
            
            this.drawWaveform(this.micAnalyser);
            this.drawFrequencySpectrum(this.micAnalyser);
        }
        
        // Análisis del video
        if (this.videoAnalyser && this.videoAudioElement && !this.videoAudioElement.paused) {
            const videoPitch = this.detectPitch(this.videoAnalyser);
            if (videoPitch && videoPitch > 0) {
                const note = this.frequencyToNote(videoPitch);
                document.getElementById('videoNote').textContent = note.note;
                document.getElementById('videoFreq').textContent = `${videoPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('videoNote').textContent = '--';
                document.getElementById('videoFreq').textContent = '0 Hz';
            }
        }
        
        this.updateMatchLevel();
    }
    
    detectPitch(analyser) {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        return this.YINDetector(buffer, this.audioContext.sampleRate);
    }
    
    YINDetector(buffer, sampleRate) {
        const threshold = 0.15; // Ajustado para mejor detección
        const bufferSize = buffer.length;
        const halfBufferSize = Math.floor(bufferSize / 2);
        const yinBuffer = new Float32Array(halfBufferSize);
        
        let probability = 0;
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
                probability = 1 - yinBuffer[tau];
                break;
            }
        }
        
        // Si no encontramos un buen candidato
        if (tau === halfBufferSize || yinBuffer[tau] >= threshold) {
            return -1;
        }
        
        // Paso 4: Interpolación parabólica para mayor precisión
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
    
    drawWaveform(analyser) {
        const canvas = document.getElementById('waveformCanvas');
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
    pitchMonitor = new HybridPitchMonitor();
});

function onYouTubeIframeAPIReady() {
    console.log('YouTube API lista');
}