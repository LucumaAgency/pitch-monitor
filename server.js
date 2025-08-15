const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy para Plesk
app.set('trust proxy', true);

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

app.get('/api/youtube-audio/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'URL de YouTube inválida' });
        }
        
        const info = await ytdl.getInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        if (audioFormats.length === 0) {
            return res.status(404).json({ error: 'No se encontraron formatos de audio' });
        }
        
        const format = audioFormats[0];
        
        res.json({
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            audioUrl: format.url,
            quality: format.audioQuality,
            format: format.container
        });
        
    } catch (error) {
        console.error('Error al procesar video de YouTube:', error);
        res.status(500).json({ error: 'Error al procesar el video' });
    }
});

app.get('/api/youtube-stream/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'URL de YouTube inválida' });
        }
        
        // Headers importantes para streaming de audio
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        
        console.log(`Streaming audio para video ID: ${videoId}`);
        
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1024 * 1024 * 10 // 10MB buffer
        });
        
        stream.on('info', (info) => {
            console.log(`Título: ${info.videoDetails.title}`);
        });
        
        stream.on('error', (error) => {
            console.error('Error en stream:', error);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error al transmitir audio' });
            }
        });
        
        stream.pipe(res);
        
    } catch (error) {
        console.error('Error al transmitir audio:', error);
        res.status(500).json({ error: 'Error al transmitir audio' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Abre http://localhost:${PORT} en tu navegador para usar la aplicación`);
});