// SERVIDOR FINAL SIMPLIFICADO
const express = require('express');
const cors = require('cors');
const path = require('path');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting Pitch Monitor Server...');

// Middleware
app.use(cors());
app.use(express.json());

// APIs
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/test', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/youtube-stream/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid URL' });
        }
        
        res.setHeader('Content-Type', 'audio/webm');
        ytdl(url, { 
            filter: 'audioonly',
            quality: 'highestaudio'
        }).pipe(res);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir archivos desde public/
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
});