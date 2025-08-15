// SERVIDOR ULTRA SIMPLE - Sin dependencias problemáticas
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('=== ULTRA SIMPLE SERVER ===');
console.log('PORT:', PORT);
console.log('DIR:', __dirname);

// API endpoints
app.get('/_api/health', (req, res) => {
    console.log('Health check requested');
    res.json({ 
        status: 'healthy',
        port: PORT,
        time: new Date().toISOString() 
    });
});

app.get('/_api/test', (req, res) => {
    console.log('Test requested');
    res.json({ 
        message: 'Working!',
        port: PORT 
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/test', (req, res) => {
    res.json({ status: 'ok' });
});

// Servir archivos
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Pitch Monitor</title></head>
        <body>
            <h1>Pitch Monitor - Working!</h1>
            <p>Server Status: Running on port ${PORT}</p>
            <ul>
                <li><a href="/_api/health">Health Check</a></li>
                <li><a href="/_api/test">Test API</a></li>
            </ul>
            <p>If you see this, Node.js is working correctly.</p>
        </body>
        </html>
    `);
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: err.message });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('CANNOT START SERVER:', err);
    process.exit(1);
});