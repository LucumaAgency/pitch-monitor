class FinalPitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        this.youtubePlayer = null;
        this.isMonitoring = false;
        this.rafId = null;
        this.serverUrl = window.location.origin;
        
        // Para el audio del video
        this.videoAudioElement = null;
        this.videoAnalyser = null;
        this.videoSource = null;
        this.videoGainNode = null;
        
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
        
        // Configurar audio para análisis
        await this.setupAudioAnalysis(videoId);
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
    
    async setupAudioAnalysis(videoId) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext creado para video, sampleRate:', this.audioContext.sampleRate);
            }
            
            // Limpiar elementos anteriores
            if (this.videoAudioElement) {
                this.videoAudioElement.pause();
                this.videoAudioElement.remove();
                if (this.videoSource) {
                    this.videoSource.disconnect();
                }
                if (this.videoGainNode) {
                    this.videoGainNode.disconnect();
                }
            }
            
            // Crear nuevo elemento de audio
            this.videoAudioElement = new Audio();
            this.videoAudioElement.crossOrigin = 'anonymous';
            this.videoAudioElement.src = `${this.serverUrl}/api/youtube-stream/${videoId}`;
            this.videoAudioElement.preload = 'auto';
            
            // Esperar a que el audio esté listo
            await new Promise((resolve, reject) => {
                this.videoAudioElement.addEventListener('canplay', resolve, { once: true });
                this.videoAudioElement.addEventListener('error', reject, { once: true });
                this.videoAudioElement.load();
            });
            
            console.log('Audio cargado, configurando Web Audio API...');
            
            // Crear nodos de Web Audio API
            this.videoSource = this.audioContext.createMediaElementSource(this.videoAudioElement);
            this.videoAnalyser = this.audioContext.createAnalyser();
            this.videoAnalyser.fftSize = 4096;
            this.videoAnalyser.smoothingTimeConstant = 0.8;
            
            // Crear GainNode para controlar el volumen de salida
            this.videoGainNode = this.audioContext.createGain();
            this.videoGainNode.gain.value = 0; // Silenciar la salida para evitar doble audio
            
            // Conectar: source -> analyser (para análisis)
            //                  -> gainNode -> destination (silenciado)
            this.videoSource.connect(this.videoAnalyser);
            this.videoSource.connect(this.videoGainNode);
            this.videoGainNode.connect(this.audioContext.destination);
            
            console.log('Análisis de audio configurado correctamente');
            this.updateStatus('Audio del video listo para análisis', 'success');
            
        } catch (error) {
            console.error('Error al configurar audio:', error);
            this.updateStatus('Error: Asegúrate de que el servidor Node.js esté corriendo (npm start)', 'error');
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
            
            // Sincronizar y reproducir audio de análisis
            if (this.videoAudioElement) {
                const currentTime = this.youtubePlayer.getCurrentTime();
                this.videoAudioElement.currentTime = currentTime;
                this.videoAudioElement.play().then(() => {
                    console.log('Audio de análisis reproduciendo');
                }).catch(err => {
                    console.error('Error al reproducir audio:', err);
                });
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
        
        // Sincronización periódica
        setInterval(() => {
            if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) {
                this.updateTimeDisplay();
                
                // Mantener sincronización
                if (this.videoAudioElement && 
                    this.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING &&
                    !this.videoAudioElement.paused) {
                    const ytTime = this.youtubePlayer.getCurrentTime();
                    const audioTime = this.videoAudioElement.currentTime;
                    const diff = Math.abs(ytTime - audioTime);
                    
                    if (diff > 0.5) {
                        console.log(`Resincronizando: YT=${ytTime.toFixed(2)}s, Audio=${audioTime.toFixed(2)}s`);
                        this.videoAudioElement.currentTime = ytTime;
                    }
                }
            }
        }, 500); // Verificar cada 500ms
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
        
        // Análisis del video
        if (this.videoAnalyser && this.videoAudioElement && !this.videoAudioElement.paused) {
            // Verificar que hay señal de audio
            const dataArray = new Uint8Array(this.videoAnalyser.frequencyBinCount);
            this.videoAnalyser.getByteFrequencyData(dataArray);
            const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            
            if (avgVolume > 5) { // Solo detectar si hay suficiente señal
                const videoPitch = this.detectPitch(this.videoAnalyser, 'video');
                if (videoPitch && videoPitch > 0) {
                    const note = this.frequencyToNote(videoPitch);
                    document.getElementById('videoNote').textContent = note.note;
                    document.getElementById('videoFreq').textContent = `${videoPitch.toFixed(1)} Hz`;
                }
            } else {
                document.getElementById('videoNote').textContent = '--';
                document.getElementById('videoFreq').textContent = '0 Hz';
            }
            
            this.drawFrequencySpectrum(this.videoAnalyser, 'frequencyCanvas');
        } else if (this.micAnalyser) {
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
        
        // Umbral de ruido
        if (rms < 0.01) {
            return -1;
        }
        
        // Usar autocorrelación mejorada para detección rápida
        return this.improvedAutocorrelate(buffer, this.audioContext.sampleRate);
    }
    
    improvedAutocorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        const MIN_SAMPLES = 0;
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        let correlations = [];
        
        // Calcular todas las correlaciones
        for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
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
            // Refinamiento con interpolación
            let y1 = correlations[bestOffset - 1] || 0;
            let y2 = correlations[bestOffset];
            let y3 = correlations[bestOffset + 1] || 0;
            
            let x0 = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
            let refinedOffset = bestOffset + x0;
            
            return sampleRate / refinedOffset;
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

// Inicializar la aplicación
let pitchMonitor;

window.addEventListener('DOMContentLoaded', () => {
    pitchMonitor = new FinalPitchMonitor();
    console.log('Pitch Monitor inicializado');
});

function onYouTubeIframeAPIReady() {
    console.log('YouTube API lista');
}