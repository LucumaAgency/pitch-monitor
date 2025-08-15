// SERVIDOR MINIMO CON EXPRESS
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting minimal server...');
console.log('PORT:', PORT);
console.log('Directory:', __dirname);

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'working',
        port: PORT,
        time: new Date().toISOString()
    });
});

// Servir un HTML simple
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Pitch Monitor - Test</title></head>
        <body>
            <h1>Server is Working!</h1>
            <p>Port: ${PORT}</p>
            <p>API Test: <a href="/api/test">/api/test</a></p>
            <p>If you see this, the server is running correctly.</p>
        </body>
        </html>
    `);
});

// Intentar servir archivos si existen
const frontendPath = path.join(__dirname, 'frontend', 'src');
if (require('fs').existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    console.log('Serving static files from:', frontendPath);
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Minimal server running on ${PORT}`);
}).on('error', (err) => {
    console.error('Cannot start server:', err);
    process.exit(1);
});