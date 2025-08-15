// SERVIDOR CORREGIDO - Orden correcto de rutas
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Pitch Monitor Server...');
console.log('Port:', PORT);
console.log('Directory:', __dirname);

// Middleware
app.use(cors());
app.use(express.json());

// ====================================
// APIs PRIMERO (antes de static files)
// ====================================

// Health check
app.get('/api/health', (req, res) => {
    console.log('Health check requested');
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Logs endpoint
app.get('/api/logs', (req, res) => {
    res.json({
        message: 'Logs endpoint working',
        timestamp: new Date().toISOString()
    });
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API is working correctly'
    });
});

// YouTube endpoints (simplificados por ahora)
app.get('/api/youtube-audio/:videoId', (req, res) => {
    res.json({
        message: 'YouTube audio endpoint',
        videoId: req.params.videoId
    });
});

app.get('/api/youtube-stream/:videoId', (req, res) => {
    res.json({
        message: 'YouTube stream endpoint',
        videoId: req.params.videoId
    });
});

// ====================================
// ARCHIVOS ESTÁTICOS DESPUÉS DE APIs
// ====================================

// Verificar que existe la carpeta frontend/src
const frontendPath = path.join(__dirname, 'frontend', 'src');
console.log('Frontend path:', frontendPath);
console.log('Frontend exists?', fs.existsSync(frontendPath));

if (fs.existsSync(frontendPath)) {
    // Listar archivos para debug
    const files = fs.readdirSync(frontendPath);
    console.log('Frontend files:', files);
    
    // Servir archivos estáticos
    app.use(express.static(frontendPath));
    
    // Ruta específica para app-final.js
    app.get('/app-final.js', (req, res) => {
        const jsPath = path.join(frontendPath, 'app-final.js');
        console.log('Serving app-final.js from:', jsPath);
        if (fs.existsSync(jsPath)) {
            res.type('application/javascript');
            res.sendFile(jsPath);
        } else {
            res.status(404).send('app-final.js not found');
        }
    });
    
    // Index.html para todas las demás rutas
    app.get('*', (req, res) => {
        const indexPath = path.join(frontendPath, 'index.html');
        console.log('Serving index.html for:', req.path);
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            res.status(404).send('index.html not found');
        }
    });
} else {
    // Si no existe frontend, servir algo básico
    app.get('/', (req, res) => {
        res.send(`
            <h1>Pitch Monitor Server</h1>
            <p>Frontend folder not found at: ${frontendPath}</p>
            <p>API Status: Working</p>
            <ul>
                <li><a href="/api/health">Health Check</a></li>
                <li><a href="/api/test">Test API</a></li>
            </ul>
        `);
    });
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('❌ Server error:', err);
    process.exit(1);
});