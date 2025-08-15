const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Logging inicial
logger.info('=================================');
logger.info('Iniciando servidor Pitch Monitor');
logger.info(`Node version: ${process.version}`);
logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Port: ${PORT}`);
logger.info('=================================');

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

// Middleware para logging de requests
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});

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
        logger.error(`Error al procesar video de YouTube: ${error.message}`);
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
        
        logger.info(`Streaming audio para video ID: ${videoId}`);
        
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1024 * 1024 * 10 // 10MB buffer
        });
        
        stream.on('info', (info) => {
            logger.info(`Streaming: ${info.videoDetails.title}`);
        });
        
        stream.on('error', (error) => {
            logger.error(`Error en stream: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error al transmitir audio' });
            }
        });
        
        stream.pipe(res);
        
    } catch (error) {
        logger.error(`Error al transmitir audio: ${error.message}`);
        res.status(500).json({ error: 'Error al transmitir audio' });
    }
});

// Endpoints para ver logs
app.get('/api/logs', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const type = req.query.type || 'all';
    const logs = logger.getLogs(lines, type);
    res.type('text/plain').send(logs);
});

app.get('/api/logs/clear', (req, res) => {
    const cleared = logger.clearLogs();
    res.json({ success: cleared });
});

// Endpoint de salud
app.get('/api/health', (req, res) => {
    logger.info('Health check requested');
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Manejo de errores global
app.use((err, req, res, next) => {
    logger.error(`Error no manejado: ${err.message}`);
    logger.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
});

// Manejo de proceso
process.on('uncaughtException', (err) => {
    logger.error(`Excepción no capturada: ${err.message}`);
    logger.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Promesa rechazada no manejada: ${reason}`);
});

app.listen(PORT, () => {
    logger.info(`Servidor corriendo en http://localhost:${PORT}`);
    logger.info(`Abre http://localhost:${PORT} en tu navegador para usar la aplicación`);
    logger.info('Logs disponibles en /api/logs');
}).on('error', (err) => {
    logger.error(`Error al iniciar servidor: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        logger.error(`El puerto ${PORT} ya está en uso`);
    }
    process.exit(1);
});