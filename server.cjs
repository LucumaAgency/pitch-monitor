/**
 * 🔥 BACKEND - Servidor Pitch Monitor
 * Express + ytdl-core para streaming de YouTube
 */

const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');
// Intentar cargar logger, si falla usar console
let logger;
try {
    logger = require('./logger');
} catch (err) {
    console.log('Logger not available, using console');
    logger = {
        info: console.log,
        error: console.error,
        warning: console.warn,
        debug: console.log,
        getLogs: () => 'Logs not available',
        clearLogs: () => false
    };
}

const app = express();
const PORT = process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ==========================================
// 📝 LOGGING INICIAL
// ==========================================
logger.info('╔════════════════════════════════════════╗');
logger.info('║     🎵 PITCH MONITOR SERVER 🎵        ║');
logger.info('╠════════════════════════════════════════╣');
logger.info(`║ Node Version: ${process.version.padEnd(25)}║`);
logger.info(`║ Environment:  ${(process.env.NODE_ENV || 'development').padEnd(25)}║`);
logger.info(`║ Port:         ${String(PORT).padEnd(25)}║`);
logger.info('╚════════════════════════════════════════╝');

// ==========================================
// ⚙️ CONFIGURACIÓN MIDDLEWARE
// ==========================================
app.set('trust proxy', true);

app.use(cors({
    origin: isDevelopment ? '*' : process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
    credentials: true
}));

app.use(express.json());

// Logging de requests
app.use((req, res, next) => {
    if (!req.path.startsWith('/static')) {
        logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
    }
    next();
});

// ==========================================
// 📁 SERVIR FRONTEND
// ==========================================
// Servir archivos estáticos del frontend
const staticPath = path.join(__dirname, 'frontend/src');
logger.info(`📁 Sirviendo archivos estáticos desde: ${staticPath}`);
app.use(express.static(staticPath));

// Log para debugging
app.use((req, res, next) => {
    if (req.path.endsWith('.js') || req.path.endsWith('.css')) {
        logger.info(`📄 Archivo solicitado: ${req.path}`);
    }
    next();
});

// ==========================================
// 🎵 API: YOUTUBE AUDIO
// ==========================================
app.get('/api/youtube-audio/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ 
                error: 'URL de YouTube inválida',
                videoId 
            });
        }
        
        logger.info(`📺 Obteniendo info del video: ${videoId}`);
        
        const info = await ytdl.getInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        if (audioFormats.length === 0) {
            return res.status(404).json({ 
                error: 'No se encontraron formatos de audio' 
            });
        }
        
        const format = audioFormats[0];
        
        res.json({
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            audioUrl: format.url,
            quality: format.audioQuality,
            format: format.container,
            thumbnail: info.videoDetails.thumbnails[0]?.url
        });
        
    } catch (error) {
        logger.error(`❌ Error al procesar video: ${error.message}`);
        res.status(500).json({ 
            error: 'Error al procesar el video',
            details: isDevelopment ? error.message : undefined
        });
    }
});

// ==========================================
// 🎵 API: YOUTUBE STREAM
// ==========================================
app.get('/api/youtube-stream/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ 
                error: 'URL de YouTube inválida' 
            });
        }
        
        // Headers para streaming
        res.setHeader('Content-Type', 'audio/webm');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('Cache-Control', 'no-cache');
        
        logger.info(`🔊 Streaming audio para: ${videoId}`);
        
        const stream = ytdl(url, {
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1024 * 1024 * 10 // 10MB buffer
        });
        
        stream.on('info', (info) => {
            logger.info(`📀 Streaming: ${info.videoDetails.title}`);
        });
        
        stream.on('error', (error) => {
            logger.error(`❌ Error en stream: ${error.message}`);
            if (!res.headersSent) {
                res.status(500).json({ 
                    error: 'Error al transmitir audio' 
                });
            }
        });
        
        stream.pipe(res);
        
    } catch (error) {
        logger.error(`❌ Error al transmitir: ${error.message}`);
        res.status(500).json({ 
            error: 'Error al transmitir audio' 
        });
    }
});

// ==========================================
// 📊 API: MONITORING & LOGS
// ==========================================
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
    };
    
    logger.info('💚 Health check: OK');
    res.json(health);
});

app.get('/api/logs', (req, res) => {
    const lines = parseInt(req.query.lines) || 100;
    const type = req.query.type || 'all';
    const logs = logger.getLogs(lines, type);
    res.type('text/plain').send(logs);
});

app.get('/api/logs/clear', (req, res) => {
    const cleared = logger.clearLogs();
    res.json({ 
        success: cleared,
        message: cleared ? 'Logs limpiados' : 'Error al limpiar logs'
    });
});

// ==========================================
// 🚨 MANEJO DE ERRORES
// ==========================================
app.use((err, req, res, next) => {
    logger.error(`❌ Error no manejado: ${err.message}`);
    logger.error(err.stack);
    
    res.status(500).json({ 
        error: 'Error interno del servidor',
        details: isDevelopment ? err.message : undefined
    });
});

// SPA fallback - todas las rutas no-API van al index
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'frontend/src/index.html');
    logger.info(`📄 Sirviendo index.html desde: ${indexPath}`);
    res.sendFile(indexPath);
});

// ==========================================
// 🚀 INICIAR SERVIDOR
// ==========================================
process.on('uncaughtException', (err) => {
    logger.error(`💥 Excepción no capturada: ${err.message}`);
    logger.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`💥 Promesa rechazada: ${reason}`);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info('╔════════════════════════════════════════╗');
    logger.info('║        🚀 SERVIDOR ACTIVO 🚀          ║');
    logger.info('╠════════════════════════════════════════╣');
    logger.info(`║ URL Local:  http://localhost:${PORT}      ║`);
    logger.info(`║ Logs:       /api/logs                  ║`);
    logger.info(`║ Health:     /api/health                ║`);
    logger.info('╚════════════════════════════════════════╝');
});

server.on('error', (err) => {
    logger.error(`❌ Error al iniciar servidor: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        logger.error(`Puerto ${PORT} ya está en uso`);
    } else if (err.code === 'EACCES') {
        logger.error(`Sin permisos para puerto ${PORT}`);
    }
    process.exit(1);
});