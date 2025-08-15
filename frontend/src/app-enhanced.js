class EnhancedPitchMonitor extends PitchMonitor {
    constructor() {
        super();
        this.serverUrl = 'http://localhost:3000';
        this.videoAudioElement = null;
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
        
        try {
            this.updateStatus('Cargando audio del video...', 'info');
            
            const response = await fetch(`${this.serverUrl}/api/youtube-audio/${videoId}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error al cargar el video');
            }
            
            this.setupAudioElement(videoId, data.title);
            
        } catch (error) {
            console.error('Error:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }
    
    setupAudioElement(videoId, title) {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (this.videoAudioElement) {
            this.videoAudioElement.pause();
            this.videoAudioElement.remove();
        }
        
        this.videoAudioElement = document.createElement('audio');
        this.videoAudioElement.crossOrigin = 'anonymous';
        this.videoAudioElement.src = `${this.serverUrl}/api/youtube-stream/${videoId}`;
        this.videoAudioElement.controls = true;
        
        const playerDiv = document.getElementById('youtubePlayer');
        playerDiv.innerHTML = `
            <div style="margin-top: 15px;">
                <p style="font-size: 14px; color: #666; margin-bottom: 10px;">${title}</p>
            </div>
        `;
        playerDiv.appendChild(this.videoAudioElement);
        
        this.videoSource = this.audioContext.createMediaElementSource(this.videoAudioElement);
        this.videoAnalyser = this.audioContext.createAnalyser();
        this.videoAnalyser.fftSize = 4096;
        this.videoAnalyser.smoothingTimeConstant = 0.8;
        
        const gainNode = this.audioContext.createGain();
        
        this.videoSource.connect(this.videoAnalyser);
        this.videoSource.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        this.videoAudioElement.addEventListener('play', () => {
            this.updateStatus('Reproduciendo audio del video', 'success');
            if (!this.isMonitoring && this.micAnalyser) {
                this.startMonitoring();
            }
        });
        
        this.videoAudioElement.addEventListener('pause', () => {
            this.updateStatus('Audio pausado', 'info');
        });
        
        this.updateStatus('Audio cargado. Presiona play para comenzar', 'success');
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
            } else {
                document.getElementById('userNote').textContent = '--';
                document.getElementById('userFreq').textContent = '0 Hz';
            }
            
            this.drawWaveform(this.micAnalyser, 'waveformCanvas');
            this.drawFrequencySpectrum(this.micAnalyser, 'frequencyCanvas');
        }
        
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
    
    drawWaveform(analyser, canvasId) {
        const canvas = document.getElementById(canvasId);
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
    
    detectPitch(analyser) {
        const bufferLength = analyser.fftSize;
        const buffer = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(buffer);
        
        const pitch = this.YINDetector(buffer, this.audioContext.sampleRate);
        return pitch;
    }
    
    YINDetector(buffer, sampleRate) {
        const threshold = 0.1;
        const bufferSize = buffer.length;
        const halfBufferSize = Math.floor(bufferSize / 2);
        const yinBuffer = new Float32Array(halfBufferSize);
        
        let probability = 0;
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
                probability = 1 - yinBuffer[tau];
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
}

window.addEventListener('DOMContentLoaded', () => {
    pitchMonitor = new EnhancedPitchMonitor();
});