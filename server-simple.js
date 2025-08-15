// Servidor ultra simple para probar en Plesk
const express = require('express');
const path = require('path');
const app = express();

// Puerto que Plesk asigna
const PORT = process.env.PORT || 3000;

console.log('Starting simple server...');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok',
        message: 'Servidor funcionando correctamente',
        port: PORT,
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Escuchar en todas las interfaces
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Test endpoint: /api/test`);
});