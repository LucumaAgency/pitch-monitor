class FinalPitchMonitor {
    constructor() {
        this.audioContext = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micSource = null;
        this.youtubePlayer = null;
        this.isMonitoring = false;
        this.rafId = null;
        // Detectar si estamos en producción o desarrollo
        this.serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000'
            : window.location.origin;
        
        // Para el audio del video
        this.videoAudioElement = null;
        this.videoAnalyser = null;
        this.videoSource = null;
        this.videoGainNode = null;
        
        this.noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Gráfico de pitch en el tiempo (estilo "Pitch Monitor")
        this.graphMinFreq = 65.41;   // C2
        this.graphMaxFreq = 1046.5;  // C6
        this.historyMax = 250;       // ~ ventana temporal
        this.micHistory = [];        // frecuencia detectada del micrófono (o null)
        this.songHistory = [];       // frecuencia detectada de la canción (o null)
        // Rango de detección de pitch (Hz)
        this.detectMinFreq = 70;
        this.detectMaxFreq = 1200;

        this.initializeEventListeners();

        // Dibujar la rejilla de notas al cargar (aunque no haya audio todavía)
        requestAnimationFrame(() => this.drawPitchGraph('waveformCanvas'));
    }
    
    initializeEventListeners() {
        document.getElementById('startMic').addEventListener('click', () => this.startMicrophone());
        document.getElementById('stopMic').addEventListener('click', () => this.stopMicrophone());
        const loadYt = document.getElementById('loadYoutube');
        if (loadYt) loadYt.addEventListener('click', () => this.loadYoutubeVideo());
        const audioFile = document.getElementById('audioFile');
        if (audioFile) audioFile.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) this.setupAudioAnalysisFromFile(file);
        });
    }

    // Analiza la nota de la canción desde un archivo local (MP3/WAV).
    // Fuente confiable: el navegador SÍ puede analizar audio local con Web Audio API,
    // a diferencia del stream de YouTube (bloqueado) o el iframe (cross-origin).
    async setupAudioAnalysisFromFile(file) {
        try {
            this.updateStatus('Cargando archivo de audio...', 'info');

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Limpiar cualquier fuente de video/audio previa
            if (this.videoAudioElement) {
                this.videoAudioElement.pause();
                if (this.videoSource) this.videoSource.disconnect();
                if (this.videoGainNode) this.videoGainNode.disconnect();
            }

            this.videoAudioElement = new Audio();
            this.videoAudioElement.src = URL.createObjectURL(file);
            this.videoAudioElement.preload = 'auto';
            this.videoAudioElement.controls = true;
            this.videoAudioElement.style.width = '100%';

            // Con MP3 no se usa YouTube: ocultar y detener el player para no duplicar audio
            if (this.youtubePlayer && typeof this.youtubePlayer.stopVideo === 'function') {
                this.youtubePlayer.stopVideo();
            }
            const ytBox = document.getElementById('youtubePlayer');
            if (ytBox) ytBox.style.display = 'none';
            const ytControls = document.getElementById('videoControls');
            if (ytControls) ytControls.style.display = 'none';

            // Mostrar el reproductor para que el usuario controle play/pausa/seek
            const playerBox = document.getElementById('audioFilePlayer');
            if (playerBox) {
                playerBox.innerHTML = '';
                playerBox.appendChild(this.videoAudioElement);
            }

            await new Promise((resolve, reject) => {
                this.videoAudioElement.addEventListener('canplay', resolve, { once: true });
                this.videoAudioElement.addEventListener('error', () => reject(new Error('Formato de audio no soportado')), { once: true });
                this.videoAudioElement.load();
            });

            this.videoSource = this.audioContext.createMediaElementSource(this.videoAudioElement);
            this.videoAnalyser = this.audioContext.createAnalyser();
            this.videoAnalyser.fftSize = 4096;
            this.videoAnalyser.smoothingTimeConstant = 0.8;

            // A diferencia de YouTube (que suena por el iframe), el archivo local
            // debe escucharse: no se silencia.
            this.videoGainNode = this.audioContext.createGain();
            this.videoGainNode.gain.value = 1;

            this.videoSource.connect(this.videoAnalyser);
            this.videoSource.connect(this.videoGainNode);
            this.videoGainNode.connect(this.audioContext.destination);

            this.videoAudioElement.play().catch(() => {});
            this.updateStatus('Canción lista. Reproduce el audio y canta para comparar.', 'success');

            if (!this.isMonitoring) this.startMonitoring();

        } catch (error) {
            console.error('Error al cargar archivo de audio:', error);
            this.updateStatus('Error: no se pudo leer el archivo de audio', 'error');
        }
    }
    
    async startMicrophone() {
        try {
            this.updateStatus('Solicitando acceso al micrófono...', 'info');
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext creado, sampleRate:', this.audioContext.sampleRate);
            }
            // En móvil/iOS el contexto arranca suspendido: sin resume() el
            // analyser del micrófono no recibe audio y "Tu Nota" queda en '--'.
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
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
        container.style.display = ''; // reaparecer si un MP3 lo ocultó
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

        // --- Micrófono (tu nota) ---
        let micPitch = -1;
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

        // --- Canción (nota del video/archivo) ---
        let songPitch = -1;
        if (this.videoAnalyser && this.videoAudioElement && !this.videoAudioElement.paused) {
            const dataArray = new Uint8Array(this.videoAnalyser.frequencyBinCount);
            this.videoAnalyser.getByteFrequencyData(dataArray);
            const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

            if (avgVolume > 3) {
                songPitch = this.detectPitch(this.videoAnalyser, 'song');
            }
            if (songPitch && songPitch > 0) {
                const note = this.frequencyToNote(songPitch);
                document.getElementById('videoNote').textContent = note.note;
                document.getElementById('videoFreq').textContent = `${songPitch.toFixed(1)} Hz`;
            } else {
                document.getElementById('videoNote').textContent = '--';
                document.getElementById('videoFreq').textContent = '0 Hz';
            }
        }

        // --- Historial y gráfico de pitch en el tiempo ---
        this.pushHistory(this.micHistory, micPitch > 0 ? micPitch : null);
        this.pushHistory(this.songHistory, songPitch > 0 ? songPitch : null);
        this.drawPitchGraph('waveformCanvas');

        this.updateMatchLevel();
    }

    pushHistory(arr, value) {
        arr.push(value);
        if (arr.length > this.historyMax) arr.shift();
    }

    // Mapea una frecuencia a la coordenada Y del gráfico (escala logarítmica de notas)
    freqToY(freq, height) {
        const logMin = Math.log2(this.graphMinFreq);
        const logMax = Math.log2(this.graphMaxFreq);
        const t = (Math.log2(freq) - logMin) / (logMax - logMin);
        return height - Math.max(0, Math.min(1, t)) * height;
    }

    midiToName(m) {
        const i = ((m % 12) + 12) % 12;
        const octave = Math.floor(m / 12) - 1;
        return this.noteStrings[i] + octave;
    }

    // Ajusta el rango vertical del gráfico al pitch realmente detectado
    // (voz + canción), con margen arriba y abajo, suavizado para no saltar.
    updateGraphRange() {
        let lo = Infinity, hi = -Infinity;
        for (const f of this.micHistory) if (f && f > 0) { if (f < lo) lo = f; if (f > hi) hi = f; }
        for (const f of this.songHistory) if (f && f > 0) { if (f < lo) lo = f; if (f > hi) hi = f; }

        let targetMin, targetMax;
        if (!isFinite(lo) || !isFinite(hi)) {
            // Sin datos aún: rango por defecto amplio
            targetMin = 65.41;   // C2
            targetMax = 1046.5;  // C6
        } else {
            // Margen de 4 semitonos arriba y abajo
            targetMin = lo * Math.pow(2, -4 / 12);
            targetMax = hi * Math.pow(2, 4 / 12);
            // Mínimo 2 octavas visibles para que no se vea aplastado
            const minSpan = Math.pow(2, 2);
            if (targetMax / targetMin < minSpan) {
                const center = Math.sqrt(targetMin * targetMax);
                targetMin = center / Math.sqrt(minSpan);
                targetMax = center * Math.sqrt(minSpan);
            }
            // Límites absolutos razonables
            targetMin = Math.max(49, targetMin);   // ~G1
            targetMax = Math.min(2093, targetMax);  // C7
        }

        // Suavizado exponencial hacia el objetivo
        const ease = 0.08;
        this.graphMinFreq += (targetMin - this.graphMinFreq) * ease;
        this.graphMaxFreq += (targetMax - this.graphMaxFreq) * ease;
    }

    drawPitchGraph(canvasId) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        this.updateGraphRange();

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const W = canvas.width, H = canvas.height;

        // Fondo oscuro
        ctx.fillStyle = '#2b2b2b';
        ctx.fillRect(0, 0, W, H);

        // Rejilla de notas: una línea por semitono. Etiquetas según el espacio:
        // si hay sitio, TODAS las notas; si no, solo las C (para no saturar).
        const startMidi = Math.ceil(69 + 12 * Math.log2(this.graphMinFreq / 440));
        const endMidi = Math.floor(69 + 12 * Math.log2(this.graphMaxFreq / 440));
        const semitoneSpacing = H / Math.max(1, (endMidi - startMidi));
        const labelAll = semitoneSpacing >= 15;
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'middle';
        for (let m = startMidi; m <= endMidi; m++) {
            const freq = 440 * Math.pow(2, (m - 69) / 12);
            const y = this.freqToY(freq, H);
            const isC = (((m % 12) + 12) % 12) === 0;
            ctx.strokeStyle = isC ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(34, y);
            ctx.lineTo(W, y);
            ctx.stroke();
            if (labelAll || isC) {
                ctx.fillStyle = isC ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
                ctx.fillText(this.midiToName(m), 4, y);
            }
        }

        // Líneas de pitch
        this.drawHistoryLine(ctx, this.songHistory, '#e0533d', W, H); // canción (rojo/naranja)
        this.drawHistoryLine(ctx, this.micHistory, '#33c1ff', W, H);  // tu voz (azul)
    }

    drawHistoryLine(ctx, history, color, W, H) {
        const n = this.historyMax;
        const step = W / (n - 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        let drawing = false;
        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
            const freq = history[i];
            const x = (i + (n - history.length)) * step;
            if (freq && freq > 0) {
                const y = this.freqToY(freq, H);
                if (!drawing) { ctx.moveTo(x, y); drawing = true; }
                else { ctx.lineTo(x, y); }
            } else {
                drawing = false; // corta la línea en silencios
            }
        }
        ctx.stroke();
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

        // Umbral de ruido. El micrófono (sobre todo con autoGainControl off)
        // suele dar señal más débil que un MP3, así que usa un piso más bajo.
        const noiseFloor = source === 'mic' ? 0.005 : 0.01;
        if (rms < noiseFloor) {
            return -1;
        }

        // Usar autocorrelación mejorada para detección rápida
        return this.improvedAutocorrelate(buffer, this.audioContext.sampleRate);
    }
    
    // Autocorrelación (basada en cwilso/PitchDetect): salta el pico de lag 0
    // para evitar errores de octava, busca dentro del rango de frecuencia
    // válido y refina con interpolación parabólica.
    improvedAutocorrelate(buffer, sampleRate) {
        const SIZE = buffer.length;

        // Recortar silencio en los bordes para mejorar la correlación
        const thres = 0.2;
        let r1 = 0, r2 = SIZE - 1;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        }
        const buf = buffer.subarray(r1, r2);
        const n = buf.length;
        if (n < 4) return -1;

        // Lags plausibles (período en muestras) para el rango de frecuencia
        const minLag = Math.max(2, Math.floor(sampleRate / this.detectMaxFreq));
        const maxLag = Math.min(n - 1, Math.floor(sampleRate / this.detectMinFreq) + 2);

        // Autocorrelación solo hasta maxLag (acota el coste)
        const c = new Array(maxLag + 1).fill(0);
        for (let lag = 0; lag <= maxLag; lag++) {
            let sum = 0;
            for (let j = 0; j < n - lag; j++) sum += buf[j] * buf[j + lag];
            c[lag] = sum;
        }

        // Saltar el pico inicial (lag 0): avanzar hasta la primera subida
        let d = 0;
        while (d < maxLag && c[d] > c[d + 1]) d++;

        // Máximo de correlación dentro del rango válido
        let maxval = -1, maxpos = -1;
        for (let lag = Math.max(d, minLag); lag <= maxLag; lag++) {
            if (c[lag] > maxval) { maxval = c[lag]; maxpos = lag; }
        }
        if (maxpos <= 0 || maxval <= 0) return -1;

        // Interpolación parabólica para afinar el período
        let T0 = maxpos;
        const x1 = c[T0 - 1] || 0, x2 = c[T0], x3 = c[T0 + 1] || 0;
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);

        return sampleRate / T0;
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