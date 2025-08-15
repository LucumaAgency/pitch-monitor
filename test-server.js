// Script de prueba para verificar que el servidor funciona
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'ok', 
        port: PORT,
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});