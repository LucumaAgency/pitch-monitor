// SERVIDOR CON DEBUG PARA YOUTUBE
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Debug Server Starting...');

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        ytdl_version: require('ytdl-core/package.json').version,
        timestamp: new Date().toISOString()
    });
});

// Test YouTube info (sin streaming)
app.get('/api/youtube-test/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        console.log(`Testing video: ${videoId}`);
        
        // Validar URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ 
                error: 'Invalid YouTube URL',
                videoId,
                url 
            });
        }
        
        // Obtener info básica
        console.log('Getting video info...');
        const info = await ytdl.getInfo(url);
        
        res.json({
            success: true,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            formats_count: info.formats.length,
            audio_formats: info.formats.filter(f => f.hasAudio && !f.hasVideo).length
        });
        
    } catch (error) {
        console.error('YouTube test error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// YouTube streaming simplificado
app.get('/api/youtube-stream/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        console.log(`Streaming: ${videoId}`);
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid URL' });
        }
        
        // Configurar headers
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Cache-Control', 'no-cache');
        
        // Stream con opciones mínimas
        const stream = ytdl(url, {
            quality: 'lowestaudio',
            filter: 'audioonly'
        });
        
        stream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message });
            }
        });
        
        stream.pipe(res);
        
    } catch (error) {
        console.error('Stream setup error:', error);
        res.status(500).json({ 
            error: error.message 
        });
    }
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Debug server on port ${PORT}`);
    console.log(`Test: http://localhost:${PORT}/api/youtube-test/dQw4w9WgXcQ`);
});