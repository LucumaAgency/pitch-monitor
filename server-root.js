// Servidor que sirve todo desde la raíz
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('Starting server-root.js');

app.use(cors());
app.use(express.json());

// APIs con prefijo único para evitar conflictos
app.get('/_api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/_api/test', (req, res) => {
    res.json({ message: 'API working' });
});

// Servir index.html desde frontend/src
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'frontend', 'src', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send('<h1>Index not found</h1>');
    }
});

// Servir app-final.js
app.get('/app-final.js', (req, res) => {
    const jsPath = path.join(__dirname, 'frontend', 'src', 'app-final.js');
    if (fs.existsSync(jsPath)) {
        res.type('application/javascript');
        res.sendFile(jsPath);
    } else {
        res.status(404).send('// app-final.js not found');
    }
});

app.listen(PORT, () => {
    console.log(`Server on ${PORT}`);
});