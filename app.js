class PitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.videoAnalyser = null;
        this.micSource = null;
        this.videoSource = null;
        this.youtubePlayer = null;
        this.isMonitoring = false;
        this.rafId = null;
        
        this.initializeEventListeners();
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
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
            
            this.updateStatus('Micrófono activo. Cantando...', 'success');
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
    
    loadYoutubeVideo() {
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
        
        if (!this.youtubePlayer) {
            this.createYoutubePlayer(videoId);
        } else {
            this.youtubePlayer.loadVideoById(videoId);
        }
    }
    
    extractVideoId(url) {
        const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }
    
    createYoutubePlayer(videoId) {
        const playerDiv = document.createElement('div');
        playerDiv.id = 'player';
        playerDiv.style.display = 'none';
        document.getElementById('youtubePlayer').appendChild(playerDiv);
        
        this.youtubePlayer = new YT.Player('player', {
            height: '0',
            width: '0',
            videoId: videoId,
            events: {
                'onReady': (event) => this.onPlayerReady(event),
                'onStateChange': (event) => this.onPlayerStateChange(event)
            }
        });
    }
    
    onPlayerReady(event) {
        this.updateStatus('Video de YouTube cargado', 'success');
        this.setupYoutubeAudioAnalysis();
    }
    
    onPlayerStateChange(event) {
        if (event.data === YT.PlayerState.PLAYING) {
            this.updateStatus('Reproduciendo video...', 'success');
            if (!this.isMonitoring && this.micAnalyser) {
                this.startMonitoring();
            }
        }
    }
    
    setupYoutubeAudioAnalysis() {
        this.updateStatus('Nota: La extracción de audio de YouTube requiere configuración adicional del servidor', 'info');
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
        
        if (this.micAnalyser) {
            const micPitch = this.detectPitch(this.micAnalyser);
            if (micPitch) {
                const note = this.frequencyToNote(micPitch);
                document.getElementById('userNote').textContent = note.note;
                document.getElementById('userFreq').textContent = `${micPitch.toFixed(1)} Hz`;
            }
            
            this.drawWaveform(this.micAnalyser);
            this.drawFrequencySpectrum(this.micAnalyser);
        }
        
        if (this.videoAnalyser) {
            const videoPitch = this.detectPitch(this.videoAnalyser);
            if (videoPitch) {
                const note = this.frequencyToNote(videoPitch);
                document.getElementById('videoNote').textContent = note.note;
                document.getElementById('videoFreq').textContent = `${videoPitch.toFixed(1)} Hz`;
            }
        }
        
        this.updateMatchLevel();
    }
    
    detectPitch(analyser) {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        return this.autoCorrelate(buffer, this.audioContext.sampleRate);
    }
    
    autoCorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        let bestOffset = -1;
        let bestCorrelation = 0;
        let rms = 0;
        
        for (let i = 0; i < SIZE; i++) {
            const val = buffer[i];
            rms += val * val;
        }
        
        rms = Math.sqrt(rms / SIZE);
        
        if (rms < 0.01) return -1;
        
        let lastCorrelation = 1;
        for (let offset = 0; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buffer[i]) - (buffer[i + offset]));
            }
            
            correlation = 1 - (correlation / MAX_SAMPLES);
            
            if (correlation > 0.9 && correlation > lastCorrelation) {
                let foundGoodCorrelation = false;
                
                if (correlation > bestCorrelation) {
                    bestCorrelation = correlation;
                    bestOffset = offset;
                    foundGoodCorrelation = true;
                }
                
                if (foundGoodCorrelation) {
                    if (bestOffset > 0) {
                        return sampleRate / bestOffset;
                    }
                }
            }
            
            lastCorrelation = correlation;
        }
        
        if (bestCorrelation > 0.01) {
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
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;
            
            const r = 102 + (dataArray[i] / 255) * 50;
            const g = 126 - (dataArray[i] / 255) * 50;
            const b = 234 - (dataArray[i] / 255) * 50;
            
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
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
            } else {
                this.updateStatus('Sigue intentando', 'info');
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
    pitchMonitor = new PitchMonitor();
});

function onYouTubeIframeAPIReady() {
    console.log('YouTube API lista');
}