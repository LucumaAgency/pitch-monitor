// SERVIDOR DE EMERGENCIA - Ultra simple para diagnosticar
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

console.log('=== EMERGENCY SERVER ===');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

// Crear servidor básico
const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <h1>Emergency Server Running</h1>
            <p>Port: ${PORT}</p>
            <p>Time: ${new Date().toISOString()}</p>
            <p><a href="/test">Test Endpoint</a></p>
        `);
    } else if (req.url === '/test') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            port: PORT,
            env: process.env.NODE_ENV,
            time: new Date().toISOString()
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Emergency server running on port ${PORT}`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});