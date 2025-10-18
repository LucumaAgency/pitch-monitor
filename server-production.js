// SERVIDOR DE PRODUCCIÓN - Sirve desde frontend/
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Production Server Starting...');
console.log('Port:', PORT);
console.log('Directory:', __dirname);

// Middleware
app.use(cors());
app.use(express.json());

// ====================================
// API ROUTES
// ====================================

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        mode: 'production',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API working in production mode'
    });
});

// YouTube API endpoints
app.get('/api/youtube-audio/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        
        const info = await ytdl.getInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        res.json({
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            audioUrl: audioFormats[0]?.url,
            format: audioFormats[0]?.container
        });
    } catch (error) {
        console.error('YouTube error:', error.message);
        res.status(500).json({ error: 'Error processing video' });
    }
});

app.get('/api/youtube-stream/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }
        
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Cache-Control', 'no-cache');
        
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio'
        });
        
        stream.pipe(res);
    } catch (error) {
        console.error('Stream error:', error.message);
        res.status(500).json({ error: 'Streaming error' });
    }
});

// ====================================
// SERVE STATIC FILES FROM FRONTEND
// ====================================

const frontendPath = path.join(__dirname, 'frontend');
console.log('Frontend directory:', frontendPath);
console.log('Frontend exists?', fs.existsSync(frontendPath));

if (fs.existsSync(frontendPath)) {
    // Servir archivos estáticos desde frontend/
    app.use(express.static(frontendPath));

    // SPA fallback
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    // Si no existe frontend/, mostrar mensaje
    app.get('/', (req, res) => {
        res.send(`
            <h1>Build Required</h1>
            <p>Frontend directory not found.</p>
            <p>API Status: <a href="/api/health">Check Health</a></p>
        `);
    });
}

// Start server
const server = require('http').createServer(app);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log('📍 APIs available at /api/*');
    console.log('📁 Static files served from /frontend');
    console.log('🔍 Test: http://localhost:' + PORT + '/api/health');
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});