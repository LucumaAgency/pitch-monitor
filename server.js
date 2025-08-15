const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');
        
        ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio'
        }).pipe(res);
        
    } catch (error) {
        console.error('Error al transmitir audio:', error);
        res.status(500).json({ error: 'Error al transmitir audio' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Abre http://localhost:${PORT} en tu navegador para usar la aplicación`);
});